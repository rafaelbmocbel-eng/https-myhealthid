import { describe, expect, it } from 'vitest';
import {
  avaliarTriagem,
  classificarChamador,
  decidirLiberacao,
  idadeEmAnos,
  normalizarTexto,
  textoTriagemParaPrompt,
  TRIAGEM_REGRAS,
  type EntradaTriagem,
} from '../../supabase/functions/_shared/triagem-bloqueio';

const TRIAGEM_LIMPA = {
  versao: 1,
  respondida_em: '2026-10-01T12:00:00.000Z',
  gestante_lactante: 'nao',
  transtorno_alimentar: 'nao',
  doenca_renal: 'nao',
  diabetes_insulina: 'nao',
  cardio_pressao: 'nao',
  cirurgia_lesao_recente: 'nao',
};

function entrada(over: Partial<EntradaTriagem> = {}): EntradaTriagem {
  return {
    foco: 'treino',
    idade: 30,
    textos: [],
    historicoClinico: null,
    triagemAutodeclarada: { ...TRIAGEM_LIMPA },
    parq: null,
    myidRedFlags: false,
    chamador: 'profissional',
    agora: new Date('2026-10-07T15:00:00Z'),
    ...over,
  };
}

function codigos(e: Partial<EntradaTriagem>) {
  return avaliarTriagem(entrada(e)).motivos.map((m) => m.codigo);
}

const historico = (condicoes: string[], extra: Record<string, unknown> = {}) => ({
  doencas_cronicas: { condicoes, detalhes: '' },
  ...extra,
});

describe('idadeEmAnos', () => {
  it('conta o aniversário só no dia, usando a data de Brasília', () => {
    const hoje = new Date('2026-10-07T15:00:00Z');
    expect(idadeEmAnos('2008-10-07', hoje)).toBe(18);
    expect(idadeEmAnos('2008-10-08', hoje)).toBe(17);
    expect(idadeEmAnos('1961-10-07', hoje)).toBe(65);
  });

  it('não adianta o aniversário nas primeiras horas UTC do dia seguinte', () => {
    // 01:00 UTC de 08/10 ainda é 22:00 de 07/10 em Brasília
    const hoje = new Date('2026-10-08T01:00:00Z');
    expect(idadeEmAnos('2008-10-08', hoje)).toBe(17);
  });

  it('devolve null para data ausente, inválida ou futura', () => {
    const hoje = new Date('2026-10-07T15:00:00Z');
    expect(idadeEmAnos(null, hoje)).toBeNull();
    expect(idadeEmAnos('', hoje)).toBeNull();
    expect(idadeEmAnos('lixo', hoje)).toBeNull();
    expect(idadeEmAnos('2030-01-01', hoje)).toBeNull();
    expect(idadeEmAnos('2000-13-40', hoje)).toBeNull();
  });
});

describe('normalizarTexto', () => {
  it('remove acentos, caixa e pontuação', () => {
    expect(normalizarTexto('GRÁVIDA, Hemodiálise; pós-parto')).toBe('gravida hemodialise pos parto');
    expect(normalizarTexto(null)).toBe('');
  });
});

describe('triagem: base', () => {
  it('liberado quando tudo foi respondido e nada foi sinalizado', () => {
    for (const foco of ['treino', 'nutricao'] as const) {
      const r = avaliarTriagem(entrada({ foco }));
      expect(r).toEqual({ nivel: 'liberado', motivos: [], dadosAusentes: [] });
    }
  });
});

describe('triagem: matriz de TREINO', () => {
  it('bloqueia menor de 18 anos', () => {
    const r = avaliarTriagem(entrada({ idade: 17 }));
    expect(r.nivel).toBe('bloqueia');
    expect(r.motivos[0]).toMatchObject({ codigo: 'menor_de_idade', nivel: 'bloqueia' });
  });

  it('18 anos completos não é menor', () => {
    expect(avaliarTriagem(entrada({ idade: 18 })).nivel).toBe('liberado');
  });

  it('bloqueia gestante ou lactante (autodeclarada e por texto)', () => {
    expect(avaliarTriagem(entrada({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, gestante_lactante: 'sim' } })).nivel).toBe('bloqueia');
    expect(avaliarTriagem(entrada({ textos: ['Estou grávida de 3 meses'] })).nivel).toBe('bloqueia');
    expect(avaliarTriagem(entrada({ textos: ['amamentando o segundo filho'] })).nivel).toBe('bloqueia');
  });

  it('pede confirmação para idoso (65 anos ou mais)', () => {
    expect(avaliarTriagem(entrada({ idade: 64 })).nivel).toBe('liberado');
    const r = avaliarTriagem(entrada({ idade: 65 }));
    expect(r.nivel).toBe('confirmar');
    expect(r.motivos[0].codigo).toBe('idoso');
  });

  it('pede confirmação quando o PAR-Q+ pede atenção', () => {
    expect(codigos({ parq: { classificacao: 'requer_atencao', respostas: null } })).toContain('parq_atencao');
    expect(codigos({ parq: { classificacao: 'liberado', respostas: { valores: { q1: 0, q2: 0 } } } })).toEqual([]);
    expect(codigos({ parq: { classificacao: null, respostas: { valores: { q6: 1 } } } })).toContain('parq_atencao');
  });

  it('PAR-Q+ q1 (coração ou pressão alta) também indica cardio', () => {
    expect(codigos({ parq: { classificacao: 'requer_atencao', respostas: { valores: { q1: 1 } } } })).toContain('cardio_pressao');
  });

  it('pede confirmação para doença renal', () => {
    const r = avaliarTriagem(entrada({ historicoClinico: historico(['Insuficiência renal']) }));
    expect(r.nivel).toBe('confirmar');
    expect(r.motivos.map((m) => m.codigo)).toContain('doenca_renal');
  });

  it('pede confirmação para diabetes com insulina ou hipoglicemiante', () => {
    expect(codigos({ textos: ['uso insulina todos os dias'] })).toContain('diabetes_insulina');
    expect(codigos({ textos: ['toma metformina'] })).toContain('diabetes_insulina');
    expect(codigos({ historicoClinico: historico(['Diabetes tipo 1']) })).toContain('diabetes_insulina');
  });

  it('diabetes tipo 2 no histórico com triagem "não" é divergência: confirmar', () => {
    expect(codigos({ historicoClinico: historico(['Diabetes tipo 2']) })).toEqual(['diabetes_insulina']);
  });

  it('diabetes tipo 2 sem confirmar o uso de insulina fica em dúvida (confirmar)', () => {
    const r = avaliarTriagem(entrada({
      historicoClinico: historico(['Diabetes tipo 2']),
      triagemAutodeclarada: { ...TRIAGEM_LIMPA, diabetes_insulina: 'nao_sei' },
    }));
    expect(r.nivel).toBe('confirmar');
    expect(r.motivos.map((m) => m.codigo)).toContain('diabetes_insulina');
  });

  it('pede confirmação para cardiopatia ou hipertensão', () => {
    expect(codigos({ historicoClinico: historico(['Hipertensão arterial']) })).toContain('cardio_pressao');
    expect(codigos({ textos: ['tenho pressão alta'] })).toContain('cardio_pressao');
    expect(codigos({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, cardio_pressao: 'sim' } })).toContain('cardio_pressao');
  });

  it('pede confirmação para cirurgia ou lesão recente', () => {
    expect(codigos({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, cirurgia_lesao_recente: 'sim' } })).toContain('cirurgia_lesao_recente');
    expect(codigos({ textos: ['pós-operatório de joelho'] })).toContain('cirurgia_lesao_recente');
    const recente = historico([], { cirurgias: { items: [{ id: '1', tipo: 'Menisco', ano: '2026', complicacoes: '' }] } });
    expect(codigos({ historicoClinico: recente })).toContain('cirurgia_lesao_recente');
    const antiga = historico([], { cirurgias: { items: [{ id: '1', tipo: 'Menisco', ano: '2015', complicacoes: '' }] } });
    expect(codigos({ historicoClinico: antiga })).toEqual([]);
  });

  it('pede confirmação quando o MyID tem red flags', () => {
    const r = avaliarTriagem(entrada({ myidRedFlags: true }));
    expect(r.nivel).toBe('confirmar');
    expect(r.motivos[0]).toMatchObject({ codigo: 'myid_red_flags', origem: 'myid' });
  });

  it('transtorno alimentar declarado pede confirmação no treino (regra provisória)', () => {
    expect(codigos({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, transtorno_alimentar: 'sim' } })).toEqual(['transtorno_alimentar']);
  });
});

describe('triagem: matriz de NUTRIÇÃO', () => {
  const nutri = (o: Partial<EntradaTriagem> = {}) => entrada({ foco: 'nutricao', ...o });

  it('bloqueia menor de idade, gestante/lactante, transtorno alimentar e doença renal', () => {
    expect(avaliarTriagem(nutri({ idade: 15 })).nivel).toBe('bloqueia');
    expect(avaliarTriagem(nutri({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, gestante_lactante: 'sim' } })).nivel).toBe('bloqueia');
    expect(avaliarTriagem(nutri({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, transtorno_alimentar: 'sim' } })).nivel).toBe('bloqueia');
    expect(avaliarTriagem(nutri({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, doenca_renal: 'sim' } })).nivel).toBe('bloqueia');
    expect(avaliarTriagem(nutri({ historicoClinico: historico(['Insuficiência renal']) })).nivel).toBe('bloqueia');
  });

  it('pede confirmação para diabetes (com ou sem insulina), idoso, cardio, bariátrica e MyID', () => {
    expect(avaliarTriagem(nutri({ historicoClinico: historico(['Diabetes tipo 2']) })).nivel).toBe('confirmar');
    expect(avaliarTriagem(nutri({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, diabetes_insulina: 'sim' } })).nivel).toBe('confirmar');
    expect(avaliarTriagem(nutri({ idade: 70 })).nivel).toBe('confirmar');
    expect(avaliarTriagem(nutri({ historicoClinico: historico(['Hipertensão arterial']) })).nivel).toBe('confirmar');
    expect(avaliarTriagem(nutri({ textos: ['fiz bariátrica em 2019'] })).nivel).toBe('confirmar');
    expect(avaliarTriagem(nutri({ historicoClinico: historico([], { cirurgias: { items: [{ tipo: 'Cirurgia bariátrica (bypass gástrico)', ano: '2018' }] } }) })).nivel).toBe('confirmar');
    expect(avaliarTriagem(nutri({ myidRedFlags: true })).nivel).toBe('confirmar');
  });

  it('PAR-Q+ de atenção e cirurgia recente não acionam regra de nutrição', () => {
    expect(codigos({ foco: 'nutricao', parq: { classificacao: 'requer_atencao', respostas: null } })).toEqual([]);
    expect(codigos({ foco: 'nutricao', triagemAutodeclarada: { ...TRIAGEM_LIMPA, cirurgia_lesao_recente: 'sim' } })).toEqual([]);
  });

  it('bloqueio vence confirmação no mesmo resultado, com bloqueio listado primeiro', () => {
    const r = avaliarTriagem(nutri({ idade: 70, textos: ['tenho bulimia'] }));
    expect(r.nivel).toBe('bloqueia');
    expect(r.motivos[0].nivel).toBe('bloqueia');
    expect(r.motivos.map((m) => m.codigo)).toEqual(['transtorno_alimentar', 'idoso']);
  });
});

describe('triagem: "não sei" e "prefiro não dizer" contam como confirmar', () => {
  it('não sei sobre gestação no treino vira confirmar (não bloqueia)', () => {
    const r = avaliarTriagem(entrada({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, gestante_lactante: 'nao_sei' } }));
    expect(r.nivel).toBe('confirmar');
    expect(r.motivos[0]).toMatchObject({ codigo: 'gestante_lactante', nivel: 'confirmar' });
  });

  it('prefiro não dizer sobre transtorno alimentar vira confirmar na nutrição', () => {
    const r = avaliarTriagem(entrada({ foco: 'nutricao', triagemAutodeclarada: { ...TRIAGEM_LIMPA, transtorno_alimentar: 'prefiro_nao_dizer' } }));
    expect(r.nivel).toBe('confirmar');
    expect(r.motivos[0]).toMatchObject({ codigo: 'transtorno_alimentar', nivel: 'confirmar' });
  });

  it('certeza por texto vence a dúvida da triagem', () => {
    const r = avaliarTriagem(entrada({
      textos: ['grávida'],
      triagemAutodeclarada: { ...TRIAGEM_LIMPA, gestante_lactante: 'nao_sei' },
    }));
    expect(r.nivel).toBe('bloqueia');
  });

  it('aceita respostas com acento e em outra caixa', () => {
    const r = avaliarTriagem(entrada({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, gestante_lactante: 'Não sei' } }));
    expect(r.motivos[0]).toMatchObject({ codigo: 'gestante_lactante', nivel: 'confirmar' });
  });
});

describe('triagem: acentos e falsos negativos', () => {
  it('encontra termos com ou sem acento e em qualquer caixa', () => {
    expect(codigos({ textos: ['GRÁVIDA'] })).toContain('gestante_lactante');
    expect(codigos({ textos: ['gravida'] })).toContain('gestante_lactante');
    expect(codigos({ textos: ['Gestação de risco'] })).toContain('gestante_lactante');
    expect(codigos({ textos: ['Lactante'] })).toContain('gestante_lactante');
    expect(codigos({ textos: ['em hemodiálise'] })).toContain('doenca_renal');
    expect(codigos({ textos: ['hemodialise 3x por semana'] })).toContain('doenca_renal');
  });

  it('não deixa passar siglas e termos usados no dia a dia', () => {
    expect(codigos({ textos: ['IRC estágio 3'] })).toContain('doenca_renal');
    expect(codigos({ textos: ['DRC'] })).toContain('doenca_renal');
    expect(codigos({ textos: ['tenho problema nos rins'] })).toContain('doenca_renal');
    expect(codigos({ foco: 'nutricao', textos: ['bulimia na adolescência'] })).toContain('transtorno_alimentar');
    expect(codigos({ foco: 'nutricao', textos: ['compulsão alimentar'] })).toContain('transtorno_alimentar');
    expect(codigos({ foco: 'nutricao', textos: ['TCA em tratamento'] })).toContain('transtorno_alimentar');
    expect(codigos({ foco: 'nutricao', textos: ['anorexia'] })).toContain('transtorno_alimentar');
  });

  it('procura nos textos do histórico clínico (medicamentos, saúde mental, cirurgias)', () => {
    const h = {
      doencas_cronicas: { condicoes: [], detalhes: '' },
      medicamentos: { items: [{ id: '1', nome: 'Insulina NPH', dose: '', frequencia: '' }] },
      saude_mental: { condicoes: ['Outras'], diagnostico_formal: true, detalhes: 'bulimia' },
    };
    expect(codigos({ historicoClinico: h })).toContain('diabetes_insulina');
    expect(codigos({ foco: 'nutricao', historicoClinico: h })).toContain('transtorno_alimentar');
  });

  it('não confunde "adrenal" com doença renal nem ignora o histórico familiar por engano', () => {
    expect(codigos({ textos: ['insuficiência adrenal tratada'] })).toEqual([]);
    const familiar = { historico_familiar: { condicoes: ['Diabetes'], detalhes: 'mãe diabética' } };
    expect(codigos({ foco: 'nutricao', historicoClinico: familiar })).toEqual([]);
  });

  it('respeita negação curta e explícita, mas "não sei se" continua sendo menção', () => {
    expect(codigos({ textos: ['Nega gestação'] })).toEqual([]);
    expect(codigos({ textos: ['não estou grávida'] })).toEqual([]);
    expect(codigos({ textos: ['sem uso de insulina'] })).toEqual([]);
    expect(codigos({ textos: ['não sei se estou grávida'] })).toContain('gestante_lactante');
    expect(codigos({ textos: ['não estou grávida mas estou amamentando'] })).toContain('gestante_lactante');
    expect(codigos({ textos: ['nega gestação. Estou grávida'] })).toContain('gestante_lactante');
  });

  it('resistência à insulina não é uso de insulina', () => {
    expect(codigos({ textos: ['resistência à insulina'] })).toEqual([]);
  });

  it('textos vazios, nulos ou fora do formato não quebram', () => {
    expect(() => avaliarTriagem(entrada({ textos: ['', '   ', null as unknown as string, 42 as unknown as string] }))).not.toThrow();
    expect(() => avaliarTriagem(entrada({ historicoClinico: 'lixo', parq: { classificacao: null, respostas: 'x' } }))).not.toThrow();
    expect(avaliarTriagem(entrada({ historicoClinico: 'lixo' })).nivel).toBe('liberado');
  });
});

describe('triagem: chamador cliente x profissional', () => {
  it('cliente: qualquer motivo, mesmo de confirmação, vira bloqueio', () => {
    const r = avaliarTriagem(entrada({ chamador: 'cliente', idade: 70 }));
    expect(r.nivel).toBe('bloqueia');
    expect(r.motivos[0].nivel).toBe('confirmar');
  });

  it('profissional com o mesmo dado só precisa confirmar', () => {
    expect(avaliarTriagem(entrada({ chamador: 'profissional', idade: 70 })).nivel).toBe('confirmar');
  });

  it('cliente sem nada sinalizado e dados completos é liberado', () => {
    expect(avaliarTriagem(entrada({ chamador: 'cliente' })).nivel).toBe('liberado');
  });

  it('cliente não vê o trecho de texto livre que acionou a regra', () => {
    const r = avaliarTriagem(entrada({ chamador: 'cliente', textos: ['anotação do profissional: gestante'] }));
    expect(r.motivos[0].detalhe).not.toMatch(/gestante/i);
    const p = avaliarTriagem(entrada({ chamador: 'profissional', textos: ['anotação do profissional: gestante'] }));
    expect(p.motivos[0].detalhe).toMatch(/gestante/);
  });
});

describe('triagem: dados ausentes', () => {
  it('idade desconhecida: cliente bloqueia, profissional confirma', () => {
    const c = avaliarTriagem(entrada({ chamador: 'cliente', idade: null }));
    expect(c.nivel).toBe('bloqueia');
    expect(c.dadosAusentes).toEqual(['idade']);
    const p = avaliarTriagem(entrada({ chamador: 'profissional', idade: null }));
    expect(p.nivel).toBe('confirmar');
    expect(p.dadosAusentes).toEqual(['idade']);
  });

  it('triagem autodeclarada ausente: cliente bloqueia, profissional confirma', () => {
    const c = avaliarTriagem(entrada({ chamador: 'cliente', triagemAutodeclarada: null }));
    expect(c.nivel).toBe('bloqueia');
    expect(c.dadosAusentes).toEqual(['triagem_autodeclarada']);
    expect(c.motivos[0].detalhe).toMatch(/triagem/i);
    const p = avaliarTriagem(entrada({ chamador: 'profissional', triagemAutodeclarada: null }));
    expect(p.nivel).toBe('confirmar');
  });

  it('triagem incompleta ou com resposta inválida conta como ausente', () => {
    expect(avaliarTriagem(entrada({ triagemAutodeclarada: {} })).dadosAusentes).toEqual(['triagem_autodeclarada']);
    expect(avaliarTriagem(entrada({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, doenca_renal: 'talvez' } })).dadosAusentes).toEqual(['triagem_autodeclarada']);
    const parcial: Record<string, unknown> = { ...TRIAGEM_LIMPA };
    delete parcial.cirurgia_lesao_recente;
    expect(avaliarTriagem(entrada({ triagemAutodeclarada: parcial })).dadosAusentes).toEqual(['triagem_autodeclarada']);
  });

  it('falha ao carregar dados (fail-closed) vira dado ausente', () => {
    const c = avaliarTriagem(entrada({ chamador: 'cliente', falhasLeitura: ['pacientes'] }));
    expect(c.nivel).toBe('bloqueia');
    expect(c.dadosAusentes).toEqual(['leitura_dados']);
    expect(avaliarTriagem(entrada({ chamador: 'profissional', falhasLeitura: ['questionarios_clinicos'] })).nivel).toBe('confirmar');
  });

  it('idade só informada pelo usuário nunca limpa o dado ausente, mas pode bloquear', () => {
    const r = avaliarTriagem(entrada({ chamador: 'profissional', idade: null, idadeInformada: 15 }));
    expect(r.dadosAusentes).toEqual(['idade']);
    expect(r.nivel).toBe('bloqueia');
    expect(r.motivos.map((m) => m.codigo)).toContain('menor_de_idade');
    const adulto = avaliarTriagem(entrada({ chamador: 'profissional', idade: null, idadeInformada: 30 }));
    expect(adulto.nivel).toBe('confirmar');
  });

  it('idade do cadastro adulta não esconde idade digitada de menor', () => {
    expect(avaliarTriagem(entrada({ idade: 30, idadeInformada: 15 })).nivel).toBe('bloqueia');
  });

  it('dados ausentes aparecem também como motivo legível', () => {
    const r = avaliarTriagem(entrada({ idade: null, triagemAutodeclarada: null }));
    expect(r.motivos.filter((m) => m.origem === 'dados_ausentes').map((m) => m.codigo))
      .toEqual(['dado_ausente_idade', 'dado_ausente_triagem']);
  });
});

describe('decidirLiberacao', () => {
  const agora = new Date('2026-10-07T15:00:00Z');
  const bloqueado = avaliarTriagem(entrada({ idade: 17 }));
  const confirmar = avaliarTriagem(entrada({ idade: 70 }));
  const liberado = avaliarTriagem(entrada());

  it('liberado passa direto e ignora override', () => {
    expect(decidirLiberacao(liberado, 'cliente', { ciente: true }, agora)).toEqual({ liberado: true, override: null, bloqueio: null });
  });

  it('cliente nunca sobrepõe, mesmo mandando override válido', () => {
    const r = decidirLiberacao(bloqueado, 'cliente', { justificativa: 'a'.repeat(40), ciente: true }, agora);
    expect(r.liberado).toBe(false);
    expect(r.override).toBeNull();
    expect(r.bloqueio?.pode_prosseguir_profissional).toBe(false);
    expect(r.bloqueio?.nivel).toBe('bloqueia');
  });

  it('profissional sem override recebe o bloqueio com pode_prosseguir_profissional', () => {
    const r = decidirLiberacao(bloqueado, 'profissional', undefined, agora);
    expect(r.liberado).toBe(false);
    expect(r.bloqueio?.pode_prosseguir_profissional).toBe(true);
    expect(r.bloqueio?.override_recusado).toBeUndefined();
    expect(r.bloqueio?.motivos).toEqual(bloqueado.motivos);
  });

  it('bloqueia exige justificativa de pelo menos 15 caracteres', () => {
    const curta = decidirLiberacao(bloqueado, 'profissional', { justificativa: '  curta demais ', ciente: true }, agora);
    expect(curta.liberado).toBe(false);
    expect(curta.bloqueio?.override_recusado).toBe('justificativa_curta');

    const quatorze = decidirLiberacao(bloqueado, 'profissional', { justificativa: '12345678901234', ciente: true }, agora);
    expect(quatorze.liberado).toBe(false);

    const semCiente = decidirLiberacao(bloqueado, 'profissional', { justificativa: '123456789012345' }, agora);
    expect(semCiente.liberado).toBe(false);
    expect(semCiente.bloqueio?.override_recusado).toBe('ciente_ausente');

    const ok = decidirLiberacao(bloqueado, 'profissional', { justificativa: '123456789012345', ciente: true }, agora);
    expect(ok.liberado).toBe(true);
    expect(ok.bloqueio).toBeNull();
    expect(ok.override).toEqual({ justificativa: '123456789012345', ciente: true, em: agora.toISOString() });
  });

  it('confirmar exige ciente === true', () => {
    const sem = decidirLiberacao(confirmar, 'profissional', { justificativa: 'texto longo o bastante' }, agora);
    expect(sem.liberado).toBe(false);
    expect(sem.bloqueio?.override_recusado).toBe('ciente_ausente');

    const texto = decidirLiberacao(confirmar, 'profissional', { ciente: 'true' }, agora);
    expect(texto.liberado).toBe(false);

    const ok = decidirLiberacao(confirmar, 'profissional', { ciente: true }, agora);
    expect(ok.liberado).toBe(true);
    expect(ok.override).toEqual({ justificativa: '', ciente: true, em: agora.toISOString() });
  });

  it('override fora do formato é ignorado', () => {
    for (const lixo of [null, 'sim', 7, [], true]) {
      expect(decidirLiberacao(bloqueado, 'profissional', lixo, agora).liberado).toBe(false);
    }
  });

  it('o mínimo da justificativa vem de TRIAGEM_REGRAS', () => {
    expect(TRIAGEM_REGRAS.justificativaMinCaracteres).toBe(15);
  });
});

describe('classificarChamador', () => {
  const base = { userId: 'u1', pacienteIdInformado: true, temPerfilProfissional: false };

  it('o dono do registro é o cliente', () => {
    expect(classificarChamador({ ...base, pacienteAlvo: { user_id: 'u1', terapeuta_id: 't1' } }))
      .toMatchObject({ ok: true, chamador: 'cliente', relacao: 'proprio_paciente' });
  });

  it('o terapeuta do paciente é profissional', () => {
    expect(classificarChamador({ ...base, temPerfilProfissional: true, pacienteAlvo: { user_id: 'p1', terapeuta_id: 'u1' } }))
      .toMatchObject({ ok: true, chamador: 'profissional', relacao: 'terapeuta_dono' });
  });

  it('perfil profissional sem ser o terapeuta do paciente é recusado', () => {
    expect(classificarChamador({ ...base, temPerfilProfissional: true, pacienteAlvo: { user_id: 'p1', terapeuta_id: 't9' } }))
      .toMatchObject({ ok: false, status: 403 });
  });

  it('quem não é o paciente, o terapeuta nem profissional é recusado', () => {
    expect(classificarChamador({ ...base, pacienteAlvo: { user_id: 'p1', terapeuta_id: 't9' } }))
      .toMatchObject({ ok: false, status: 403 });
  });

  it('paciente_id inexistente é 404', () => {
    expect(classificarChamador({ ...base, temPerfilProfissional: true, pacienteAlvo: null }))
      .toMatchObject({ ok: false, status: 404 });
  });

  it('sem paciente_id: usa o próprio paciente (cliente) ou o perfil profissional', () => {
    const semId = { userId: 'u1', pacienteIdInformado: false };
    expect(classificarChamador({ ...semId, temPerfilProfissional: false, pacienteAlvo: { user_id: 'u1', terapeuta_id: null } }))
      .toMatchObject({ ok: true, chamador: 'cliente' });
    expect(classificarChamador({ ...semId, temPerfilProfissional: true, pacienteAlvo: null }))
      .toMatchObject({ ok: true, chamador: 'profissional', relacao: 'profissional_sem_paciente' });
    expect(classificarChamador({ ...semId, temPerfilProfissional: false, pacienteAlvo: null }))
      .toMatchObject({ ok: false, status: 403 });
  });
});

describe('textoTriagemParaPrompt', () => {
  it('vazio quando nada foi sinalizado', () => {
    expect(textoTriagemParaPrompt(avaliarTriagem(entrada()), 'treino')).toBe('');
  });

  it('lista só os rótulos e pede conduta conservadora, sem trechos de texto livre', () => {
    const r = avaliarTriagem(entrada({ foco: 'nutricao', idade: 70, textos: ['diabetes'] }));
    const t = textoTriagemParaPrompt(r, 'nutricao');
    expect(t).toMatch(/CONSERVADOR/);
    expect(t).toMatch(/Diabetes/);
    expect(t).not.toMatch(/Menção a/);
  });

  it('não repete dado ausente como se fosse condição de saúde', () => {
    const r = avaliarTriagem(entrada({ triagemAutodeclarada: null }));
    expect(textoTriagemParaPrompt(r, 'treino')).toBe('');
  });
});

describe('TRIAGEM_REGRAS é editável', () => {
  it('mover um código de foco muda o resultado sem tocar na lógica', () => {
    const niveis = TRIAGEM_REGRAS.niveis.treino;
    const e = entrada({ triagemAutodeclarada: { ...TRIAGEM_LIMPA, transtorno_alimentar: 'sim' } });
    expect(avaliarTriagem(e).nivel).toBe('confirmar');
    niveis.transtorno_alimentar = 'bloqueia';
    try {
      expect(avaliarTriagem(e).nivel).toBe('bloqueia');
    } finally {
      niveis.transtorno_alimentar = 'confirmar';
    }
    expect(avaliarTriagem(e).nivel).toBe('confirmar');
  });
});

describe('triagem: negação só vale na mesma oração', () => {
  const codigosTexto = (t: string) => avaliarTriagem(entrada({ textos: [t], triagemAutodeclarada: TRIAGEM_LIMPA })).motivos.map((m) => m.codigo);

  it.each([
    'Fuma: não. Gestante: sim',
    'Não, gestante de 12 semanas',
    'Sem. Gestante',
    'Não, estou grávida de 3 meses',
  ])('"%s" continua sinalizando gestação', (t) => {
    expect(codigosTexto(t)).toContain('gestante_lactante');
  });

  it('"Diabetes: não. Hipertensão: sim" sinaliza a hipertensão', () => {
    expect(codigosTexto('Diabetes: não. Hipertensão: sim, em uso de losartana')).toContain('cardio_pressao');
  });

  it('negação na mesma oração segue valendo e "coração de galinha" não é condição', () => {
    expect(codigosTexto('não estou grávida')).toEqual([]);
    expect(codigosTexto('não gosto de coração de galinha')).toEqual([]);
    expect(codigosTexto('tem problema no coração')).toContain('cardio_pressao');
  });
});
