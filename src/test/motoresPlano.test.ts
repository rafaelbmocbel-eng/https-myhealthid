import { describe, expect, it } from 'vitest';
import {
  carregarMotoresClinicos,
  clientePodeGerar,
  insumosDosMotores,
  montarEntradaTriagem,
  resolverContextoGeracao,
  textoAnamneseNutricional,
  textoFichaClinica,
  textoHistoricoClinico,
  textoHistoriaAtual,
  textoPresencial,
} from '../../supabase/functions/_shared/motores-plano';
import { avaliarTriagem } from '../../supabase/functions/_shared/triagem-bloqueio';

type Resultado = { data?: unknown; error?: { message: string } | null };

// Cliente Supabase falso: registra o select de cada tabela e devolve o que o teste definir.
function fakeAdmin(tabelas: Record<string, Resultado>) {
  const selects: Record<string, string[]> = {};
  const admin = {
    from(tabela: string) {
      const res: Resultado = { data: null, error: null, ...(tabelas[tabela] ?? {}) };
      const chain: Record<string, unknown> = {};
      const volta = () => chain;
      chain.select = (cols: string) => { (selects[tabela] ||= []).push(cols); return chain; };
      for (const m of ['eq', 'neq', 'order', 'limit', 'not', 'overlaps']) chain[m] = volta;
      chain.maybeSingle = () => Promise.resolve(res);
      chain.then = (ok: (r: Resultado) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(res).then(ok, ko);
      return chain;
    },
  };
  return { admin, selects };
}

describe('textoHistoriaAtual', () => {
  it('converte o jsonb em texto legível em vez de [object Object]', () => {
    const t = textoHistoriaAtual({ queixa: 'dor lombar', inicio: 'há 3 meses', fatores: 'piora sentada', impacto: 'não consigo treinar', atualizado_em: '2026-10-01' });
    expect(t).toBe('Queixa: dor lombar; Início: há 3 meses; Fatores que pioram ou aliviam: piora sentada; Impacto no dia a dia: não consigo treinar');
    expect(t).not.toMatch(/object/i);
  });

  it('aceita string, nulo e formatos estranhos', () => {
    expect(textoHistoriaAtual('texto antigo')).toBe('texto antigo');
    expect(textoHistoriaAtual(null)).toBe('');
    expect(textoHistoriaAtual(undefined)).toBe('');
    expect(textoHistoriaAtual([1, 2])).toBe('');
    expect(textoHistoriaAtual({ queixa: '', inicio: '  ' })).toBe('');
  });
});

describe('textoHistoricoClinico e textoFichaClinica', () => {
  const historico = {
    doencas_cronicas: { condicoes: ['Diabetes tipo 2'], detalhes: 'desde 2019' },
    cirurgias: { items: [{ id: '1', tipo: 'Menisco', ano: '2025', complicacoes: '' }] },
    medicamentos: { items: [{ id: '1', nome: 'Metformina', dose: '', frequencia: '' }] },
    alergias: { medicamentos: 'dipirona', alimentos: '', outros: '' },
    saude_mental: { condicoes: ['Ansiedade'], diagnostico_formal: false, detalhes: '' },
    historico_familiar: { condicoes: ['Câncer'], detalhes: '' },
  };

  it('resume o histórico sem incluir o histórico familiar', () => {
    const t = textoHistoricoClinico(historico);
    expect(t).toContain('Diabetes tipo 2');
    expect(t).toContain('Menisco (2025)');
    expect(t).toContain('Metformina');
    expect(t).toContain('dipirona');
    expect(t).not.toMatch(/Câncer/);
    expect(textoHistoricoClinico('lixo')).toBe('');
  });

  it('a ficha clínica traz medicamentos, alergias, histórico e a triagem em linguagem clara', () => {
    const motores = {
      medicamentos: 'losartana', alergias: 'amendoim', historicoClinico: historico,
      triagemAutodeclarada: { gestante_lactante: 'nao', diabetes_insulina: 'nao_sei', cirurgia_lesao_recente: 'nao' },
    } as unknown as Parameters<typeof textoFichaClinica>[0];
    const t = textoFichaClinica(motores);
    expect(t).toContain('losartana');
    expect(t).toContain('amendoim');
    expect(t).toContain('diabetes ou uso de insulina: não sei');
    expect(t).toContain('gestação ou amamentação: não');
  });

  it('vazio quando não há nada declarado', () => {
    const motores = { medicamentos: null, alergias: null, historicoClinico: null, triagemAutodeclarada: null } as unknown as Parameters<typeof textoFichaClinica>[0];
    expect(textoFichaClinica(motores)).toBe('');
  });
});

describe('textoAnamneseNutricional', () => {
  it('mantém restricoes_alergias mesmo com respostas anteriores longas (o corte de 800 caracteres a perdia)', () => {
    const respostas = {
      peso_kg: '70', altura_cm: '170', idade: '30', sexo: 'feminino', nivel_atividade: 'moderado',
      objetivo: 'o'.repeat(900), refeicoes_por_dia: '5',
      restricoes_alergias: 'alergia grave a amendoim e camarão',
      aversoes: 'a'.repeat(400), preferencias: 'p'.repeat(400), rotina: 'r'.repeat(400),
    };
    const antes = JSON.stringify(respostas).slice(0, 800);
    expect(antes).not.toContain('amendoim');
    const t = textoAnamneseNutricional(respostas);
    expect(t).toContain('alergia grave a amendoim e camarão');
    expect(t.indexOf('restricoes_alergias')).toBe(0);
  });

  it('não repete a autodeclaração (chave triagem) e ignora valores vazios ou aninhados', () => {
    const t = textoAnamneseNutricional({ restricoes_alergias: 'nenhuma', triagem: { gestante_lactante: 'sim' }, aversoes: '', rotina: { x: 1 } });
    expect(t).toBe('restricoes_alergias: nenhuma');
    expect(textoAnamneseNutricional(null)).toBe('');
  });
});

describe('carregarMotoresClinicos', () => {
  const pacienteOk = {
    queixa_principal: 'dor no ombro',
    historia_atual: { queixa: 'dor no ombro', inicio: 'há 1 mês' },
    condicoes_preexistentes: 'hipertensão',
    alergias: null,
    medicamentos_uso: 'losartana',
    historico_clinico: { doencas_cronicas: { condicoes: ['Hipertensão arterial'], detalhes: '' } },
    data_nascimento: '1990-05-20',
    genero: 'feminino',
    sexo: null,
  };

  it('não pede a coluna inexistente condicoes_saude e pede as colunas reais', async () => {
    const { admin, selects } = fakeAdmin({ pacientes: { data: pacienteOk } });
    await carregarMotoresClinicos(admin, 'p1');
    const cols = selects.pacientes.join(',');
    expect(cols).not.toContain('condicoes_saude');
    for (const c of ['condicoes_preexistentes', 'alergias', 'medicamentos_uso', 'historico_clinico', 'data_nascimento', 'genero']) {
      expect(cols).toContain(c);
    }
  });

  it('expõe o que a triagem precisa: idade exata, texto legível, histórico, triagem, PAR-Q+ e red flags', async () => {
    const { admin } = fakeAdmin({
      pacientes: { data: pacienteOk },
      myid_avaliacoes: { data: { resultado_processado: { scores: { D: 5 }, red_flags_detected: true } } },
      questionarios_clinicos: { data: [{ instrumento: 'parq', escore: 2, classificacao: 'requer_atencao', respostas: { valores: { q1: 1 } } }] },
      nutricao_anamnese: { data: { respostas: { restricoes_alergias: 'nenhuma', triagem: { gestante_lactante: 'nao' } } } },
    });
    const m = await carregarMotoresClinicos(admin, 'p1');
    expect(typeof m.paciente.idade).toBe('number');
    expect(m.paciente.dataNascimento).toBe('1990-05-20');
    expect(m.paciente.genero).toBe('feminino');
    expect(m.historia).toBe('Queixa: dor no ombro; Início: há 1 mês');
    expect(m.condicoes).toBe('hipertensão');
    expect(m.medicamentos).toBe('losartana');
    expect(m.historicoClinico).toEqual(pacienteOk.historico_clinico);
    expect(m.triagemAutodeclarada).toEqual({ gestante_lactante: 'nao' });
    expect(m.parq).toEqual({ classificacao: 'requer_atencao', respostas: { valores: { q1: 1 } } });
    expect(m.myidRedFlags).toBe(true);
    expect(m.falhasLeitura).toEqual([]);
    expect(textoPresencial(m, 'treino')).toContain('Condições de saúde: hipertensão');
    expect(textoPresencial(m, 'treino')).not.toContain('[object Object]');
    expect(insumosDosMotores(m, 'nutricao')).toEqual(expect.arrayContaining(['MyID', 'questionarios', 'anamnese', 'historico_clinico', 'queixa_historia_atual']));
    expect(insumosDosMotores(m, 'treino')).not.toContain('anamnese');
    expect(insumosDosMotores(null, 'treino')).toEqual([]);
  });

  it('erro do banco vira falha de leitura (fail-closed), não "sem dados"', async () => {
    const { admin } = fakeAdmin({
      pacientes: { data: null, error: { message: 'column does not exist' } },
      questionarios_clinicos: { data: null, error: { message: 'boom' } },
    });
    const m = await carregarMotoresClinicos(admin, 'p1');
    expect(m.falhasLeitura).toEqual(expect.arrayContaining(['pacientes', 'questionarios_clinicos']));
    const t = avaliarTriagem(montarEntradaTriagem({ foco: 'treino', chamador: 'cliente', motores: m }));
    expect(t.nivel).toBe('bloqueia');
    expect(t.dadosAusentes).toContain('leitura_dados');
  });

  it('red flag do MyID importado (avaliacoes_identidade) também conta', async () => {
    const { admin } = fakeAdmin({
      pacientes: { data: pacienteOk },
      avaliacoes_identidade: { data: { myid_analysis: { redFlagsDetected: true, component_scores: { D: 3 } } } },
    });
    const m = await carregarMotoresClinicos(admin, 'p1');
    expect(m.myidRedFlags).toBe(true);
  });

  it('sem paciente_id devolve vazio sem consultar nada', async () => {
    const { admin, selects } = fakeAdmin({});
    const m = await carregarMotoresClinicos(admin, '');
    expect(m.falhasLeitura).toEqual([]);
    expect(Object.keys(selects)).toHaveLength(0);
  });
});

describe('montarEntradaTriagem', () => {
  const base = {
    scores: null, queixa: 'dor', historia: 'Queixa: dor', condicoes: 'nenhuma', presencial: [{ tipo_achado: 'Diabetes mellitus', notas_clinicas: 'paciente grávida' }],
    exames: [], questionarios: [], avaliacaoVoz: null,
    paciente: { dataNascimento: '1990-01-01', idade: 36, genero: null, sexo: null },
    medicamentos: 'losartana', alergias: null, historicoClinico: null,
    anamnese: { restricoes_alergias: 'lactose', idade: '15', triagem: { gestante_lactante: 'nao' } },
    triagemAutodeclarada: { gestante_lactante: 'nao' }, parq: null, myidRedFlags: false, falhasLeitura: [],
  } as unknown as Parameters<typeof montarEntradaTriagem>[0]['motores'];

  it('reúne textos do cadastro, da anamnese, dos achados e do pedido, sem a autodeclaração', () => {
    const e = montarEntradaTriagem({ foco: 'nutricao', chamador: 'profissional', motores: base, textosPedido: ['sem glúten', null, 7] });
    expect(e.textos).toEqual(expect.arrayContaining(['dor', 'Queixa: dor', 'nenhuma', 'losartana', 'lactose', 'Diabetes mellitus', 'paciente grávida', 'sem glúten']));
    expect(e.textos.join(' ')).not.toContain('gestante_lactante');
    expect(e.idade).toBe(36);
    expect(avaliarTriagem(e).motivos.map((m) => m.codigo)).toEqual(expect.arrayContaining(['gestante_lactante', 'diabetes']));
  });

  it('profissional com data de nascimento cadastrada: a idade digitada não conta', () => {
    const e = montarEntradaTriagem({ foco: 'treino', chamador: 'profissional', motores: base, idadeBody: 17 });
    expect(e.idadeInformada).toBeNull();
  });

  it('cliente com data de nascimento cadastrada: a idade velha da anamnese não bloqueia', () => {
    const e = montarEntradaTriagem({ foco: 'nutricao', chamador: 'cliente', motores: base, idadeBody: 17 });
    expect(e.idadeInformada).toBeNull();
    expect(avaliarTriagem(e).motivos.map((m) => m.codigo)).not.toContain('menor_de_idade');
  });

  it('cliente sem data de nascimento: a idade digitada entra e pode bloquear (usa a menor)', () => {
    const semData = { ...(base as object), paciente: { dataNascimento: null, idade: null, genero: null, sexo: null } } as unknown as typeof base;
    const e = montarEntradaTriagem({ foco: 'nutricao', chamador: 'cliente', motores: semData, idadeBody: 40 });
    expect(e.idadeInformada).toBe(15);
    expect(avaliarTriagem(e).motivos.map((m) => m.codigo)).toContain('menor_de_idade');
  });

  it('sem data de nascimento cadastrada, a idade digitada entra mesmo para o profissional', () => {
    const semData = { ...(base as object), paciente: { dataNascimento: null, idade: null, genero: null, sexo: null }, anamnese: { restricoes_alergias: 'lactose' } } as unknown as typeof base;
    const e = montarEntradaTriagem({ foco: 'treino', chamador: 'profissional', motores: semData, idadeBody: '16' });
    expect(e.idade).toBeNull();
    expect(e.idadeInformada).toBe(16);
  });

  it('sem paciente (profissional sem paciente_id), usa só o que veio no pedido', () => {
    const e = montarEntradaTriagem({ foco: 'treino', chamador: 'profissional', motores: null, idadeBody: 30, textosPedido: ['tenho IRC'] });
    expect(e.idade).toBeNull();
    expect(e.idadeInformada).toBe(30);
    expect(e.triagemAutodeclarada).toBeNull();
    const r = avaliarTriagem(e);
    expect(r.nivel).toBe('confirmar');
    expect(r.dadosAusentes).toEqual(['idade', 'triagem_autodeclarada']);
    expect(r.motivos.map((m) => m.codigo)).toContain('doenca_renal');
  });
});

describe('clientePodeGerar', () => {
  it('só o Premium pode gerar: o teste grátis de 7 dias não vale mais', () => {
    expect(clientePodeGerar({ tipo_conta: 'wellness_premium' })).toBe(true);
    expect(clientePodeGerar({ tipo_conta: 'wellness_free', created_at: new Date().toISOString() } as never)).toBe(false);
    expect(clientePodeGerar({ tipo_conta: 'clinico' })).toBe(false);
    expect(clientePodeGerar({ tipo_conta: null })).toBe(false);
    expect(clientePodeGerar({})).toBe(false);
    expect(clientePodeGerar(null)).toBe(false);
  });
});

describe('resolverContextoGeracao', () => {
  const U = '11111111-1111-4111-8111-111111111111';
  const P = '22222222-2222-4222-8222-222222222222';
  const alvo = (o: object) => ({ id: P, user_id: null, terapeuta_id: null, tipo_conta: 'wellness_premium', created_at: '2026-01-01', ...o });

  it('o dono do cadastro é o cliente', async () => {
    const { admin } = fakeAdmin({ pacientes: { data: alvo({ user_id: U }) } });
    const r = await resolverContextoGeracao(admin, U, P);
    expect(r).toMatchObject({ ok: true, chamador: 'cliente', pacienteId: P });
  });

  it('o terapeuta do paciente com perfil confirmado é profissional', async () => {
    const { admin } = fakeAdmin({ pacientes: { data: alvo({ terapeuta_id: U }) }, profiles: { data: { user_id: U, perfil_profissional_confirmado: true } } });
    expect(await resolverContextoGeracao(admin, U, P)).toMatchObject({ ok: true, chamador: 'profissional', relacao: 'terapeuta_dono' });
  });

  it('terapeuta_id forjado (perfil não confirmado) ou sem vínculo é recusado', async () => {
    const forjado = fakeAdmin({ pacientes: { data: alvo({ terapeuta_id: U }) }, profiles: { data: { user_id: U, perfil_profissional_confirmado: false } } });
    expect(await resolverContextoGeracao(forjado.admin, U, P)).toMatchObject({ ok: false, status: 403 });
    const com = fakeAdmin({ pacientes: { data: alvo({ terapeuta_id: 'outro' }) }, profiles: { data: { user_id: U, perfil_profissional_confirmado: true } } });
    expect(await resolverContextoGeracao(com.admin, U, P)).toMatchObject({ ok: false, status: 403 });
    const sem = fakeAdmin({ pacientes: { data: alvo({ terapeuta_id: 'outro', user_id: 'outro2' }) }, profiles: { data: null } });
    expect(await resolverContextoGeracao(sem.admin, U, P)).toMatchObject({ ok: false, status: 403 });
  });

  it('sem paciente_id usa o próprio cadastro do usuário', async () => {
    const { admin } = fakeAdmin({ pacientes: { data: alvo({ user_id: U }) } });
    expect(await resolverContextoGeracao(admin, U, undefined)).toMatchObject({ ok: true, chamador: 'cliente', pacienteId: P });
  });

  it('sem paciente_id e sem cadastro: profissional passa sem paciente, o resto é recusado', async () => {
    const prof = fakeAdmin({ pacientes: { data: null }, profiles: { data: { user_id: U, perfil_profissional_confirmado: true } } });
    expect(await resolverContextoGeracao(prof.admin, U, '')).toMatchObject({ ok: true, chamador: 'profissional', pacienteId: null });
    const nada = fakeAdmin({ pacientes: { data: null }, profiles: { data: null } });
    expect(await resolverContextoGeracao(nada.admin, U, null)).toMatchObject({ ok: false, status: 403 });
  });

  it('paciente_id inexistente é 404 e malformado é 400', async () => {
    const { admin } = fakeAdmin({ pacientes: { data: null }, profiles: { data: { user_id: U } } });
    expect(await resolverContextoGeracao(admin, U, P)).toMatchObject({ ok: false, status: 404 });
    expect(await resolverContextoGeracao(admin, U, 'não-é-uuid')).toMatchObject({ ok: false, status: 400 });
  });

  it('erro de leitura recusa (fail-closed) em vez de liberar', async () => {
    const a = fakeAdmin({ pacientes: { data: null, error: { message: 'timeout' } } });
    expect(await resolverContextoGeracao(a.admin, U, P)).toMatchObject({ ok: false, status: 503 });
    const b = fakeAdmin({ pacientes: { data: alvo({ terapeuta_id: U }) }, profiles: { data: null, error: { message: 'timeout' } } });
    expect(await resolverContextoGeracao(b.admin, U, P)).toMatchObject({ ok: false, status: 503 });
  });
});
