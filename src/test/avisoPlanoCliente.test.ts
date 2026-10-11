import { describe, expect, it } from 'vitest';
import {
  chamadorPodeAvisar,
  decidirAviso,
  GATILHO_AVISO,
  JANELA_AVISO_HORAS,
  montarMensagemAviso,
  ORIGEM_AVISO,
  primeiroNome,
  telefoneUtilizavel,
  type PacienteParaAviso,
  type PlanoParaAviso,
} from '../../supabase/functions/_shared/aviso-plano-cliente';

const AGORA = new Date('2026-10-08T15:00:00Z');
const hAtras = (h: number) => new Date(AGORA.getTime() - h * 3600_000).toISOString();

const PLANO: PlanoParaAviso = {
  id: 'c0000000-0000-4000-8000-000000000001',
  paciente_id: 'b0000000-0000-4000-8000-000000000001',
  tipo: 'treino',
  status: 'chancelado',
  revisado_em: hAtras(1),
};
const PACIENTE: PacienteParaAviso = { nome: 'JOAO SILVA SANTOS', telefone: '(11) 99999-0000', ativo: true, user_id: 'a0000000-0000-4000-8000-000000000006' };
const REMETENTE = 'a0000000-0000-4000-8000-000000000005';

function decidir(over: Partial<Parameters<typeof decidirAviso>[0]> = {}) {
  return decidirAviso({ plano: PLANO, paciente: PACIENTE, remetenteId: REMETENTE, jaNotificado: false, agora: AGORA, ...over });
}

describe('aviso ao cliente: texto', () => {
  it('primeiroNome: aparado, com a inicial maiúscula (o cadastro guarda tudo em maiúsculas)', () => {
    expect(primeiroNome('JOAO SILVA SANTOS')).toBe('Joao');
    expect(primeiroNome('  maria  ')).toBe('Maria');
    expect(primeiroNome('')).toBe('');
    expect(primeiroNome(null)).toBe('');
    expect(primeiroNome(undefined)).toBe('');
  });

  it('primeiroNome: o cliente edita o cadastro, então só entra o que parece um nome', () => {
    for (const lixo of ['bit.ly/xyz', 'http://golpe.com', 'www.x.com', '12345', 'Joao123', '@canal', '<b>x</b>', '$$$', 'a'.repeat(31), '-Joao', "'Ana"]) {
      expect(primeiroNome(lixo), lixo).toBe('');
      expect(primeiroNome(`${lixo} Silva`), lixo).toBe('');
    }
    expect(primeiroNome("D'ÁVILA")).toBe("D'ávila");
    expect(primeiroNome('MARIA-JOSÉ SILVA')).toBe('Maria-josé');
    expect(primeiroNome('Çağlar')).toBe('Çağlar');
    expect(primeiroNome('a'.repeat(30))).toBe(`A${'a'.repeat(29)}`);
  });

  it('nome com link não chega à mensagem: sai "Oi!" sem nome', () => {
    for (const status of ['chancelado', 'recusado'] as const) {
      const m = montarMensagemAviso(status, 'treino', 'bit.ly/xyz');
      expect(m).toMatch(/^Oi! /);
      expect(m).not.toMatch(/bit\.ly|xyz|http|www/i);
    }
  });

  it('chancelado: curto, acolhedor e manda abrir o app', () => {
    const m = montarMensagemAviso('chancelado', 'treino', 'JOAO SILVA');
    expect(m).toBe('Oi Joao! Seu plano de treino foi revisado pela equipe científica do MyHealthID e já está disponível no seu portal. É só abrir o app para ver.');
    expect(m.length).toBeLessThan(200);
    expect(montarMensagemAviso('chancelado', 'nutricao', 'ana')).toMatch(/^Oi Ana! Seu plano alimentar foi revisado/);
  });

  it('recusado: avisa que há um recado no portal, sem repetir o recado', () => {
    const m = montarMensagemAviso('recusado', 'nutricao', 'ANA');
    expect(m).toBe('Oi Ana! A equipe científica do MyHealthID revisou o seu plano alimentar e deixou um recado para você no portal. É só abrir o app para ver.');
    expect(montarMensagemAviso('recusado', 'treino', 'ANA')).toMatch(/seu plano de treino/);
  });

  it('sem nome: saudação genérica', () => {
    expect(montarMensagemAviso('chancelado', 'treino', null)).toMatch(/^Oi! Seu plano de treino/);
  });

  it('nunca leva conteúdo clínico, risco, nota ou quem revisou', () => {
    for (const status of ['chancelado', 'recusado'] as const) {
      for (const tipo of ['treino', 'nutricao']) {
        const m = montarMensagemAviso(status, tipo, 'JOAO');
        expect(m).not.toMatch(/risco|alto|diabetes|gestan|lesão|dor|kcal|caloria|justific|nota|revisor|chancelado por|http/i);
      }
    }
  });
});

describe('aviso ao cliente: telefone', () => {
  it('aceita número com DDD, com ou sem máscara e código do país', () => {
    for (const ok of ['(11) 99999-0000', '11999990000', '+55 11 99999-0000', '1133334444']) expect(telefoneUtilizavel(ok)).toBe(true);
  });
  it('recusa vazio, curto ou lixo', () => {
    for (const ruim of [null, undefined, '', '   ', '12345', '999-0000', 'sem telefone']) expect(telefoneUtilizavel(ruim)).toBe(false);
  });
});

describe('aviso ao cliente: quando sai', () => {
  it('cliente cadastrado e ativo, plano decidido há pouco: sai, com gatilho, texto e número só com dígitos', () => {
    const d = decidir();
    expect(d).toEqual({
      enviar: true,
      status: 'chancelado',
      gatilho: 'plano_chancelado',
      mensagem: montarMensagemAviso('chancelado', 'treino', PACIENTE.nome),
      telefone: '11999990000',
      remetenteId: REMETENTE,
    });
  });

  it('recusado usa o gatilho próprio', () => {
    const d = decidir({ plano: { ...PLANO, status: 'recusado', tipo: 'nutricao' } });
    expect(d).toMatchObject({ enviar: true, status: 'recusado', gatilho: 'plano_recusado' });
    expect(GATILHO_AVISO).toEqual({ chancelado: 'plano_chancelado', recusado: 'plano_recusado' });
    expect(ORIGEM_AVISO).toBe('plano_cliente');
  });

  it('só avisa plano decidido: aguardando, cancelado, substituído e sem data não saem', () => {
    for (const status of ['aguardando', 'cancelado', 'substituido', null]) {
      expect(decidir({ plano: { ...PLANO, status } })).toEqual({ enviar: false, motivo: 'plano_nao_decidido' });
    }
    expect(decidir({ plano: { ...PLANO, revisado_em: null } })).toEqual({ enviar: false, motivo: 'plano_nao_decidido' });
    expect(decidir({ plano: { ...PLANO, revisado_em: 'ontem' } })).toEqual({ enviar: false, motivo: 'plano_nao_decidido' });
  });

  it('decisão antiga não é reavisada (janela de 48 horas)', () => {
    expect(JANELA_AVISO_HORAS).toBe(48);
    expect(decidir({ plano: { ...PLANO, revisado_em: hAtras(47) } })).toMatchObject({ enviar: true });
    expect(decidir({ plano: { ...PLANO, revisado_em: hAtras(49) } })).toEqual({ enviar: false, motivo: 'fora_da_janela' });
  });

  it('plano inexistente', () => {
    expect(decidir({ plano: null })).toEqual({ enviar: false, motivo: 'plano_nao_encontrado' });
  });

  it('só cliente cadastrado e ativo: inativo, sem conta ou inexistente não recebem', () => {
    expect(decidir({ paciente: { ...PACIENTE, ativo: false } })).toEqual({ enviar: false, motivo: 'cliente_inativo' });
    expect(decidir({ paciente: { ...PACIENTE, user_id: null } })).toEqual({ enviar: false, motivo: 'cliente_sem_conta' });
    expect(decidir({ paciente: null })).toEqual({ enviar: false, motivo: 'cliente_nao_encontrado' });
  });

  it('cadastro sem a marca de ativo (nulo) não recebe: as outras automações também exigem ativo = true', () => {
    expect(decidir({ paciente: { ...PACIENTE, ativo: null } })).toEqual({ enviar: false, motivo: 'cliente_inativo' });
  });

  it('sem telefone utilizável não sai', () => {
    expect(decidir({ paciente: { ...PACIENTE, telefone: null } })).toEqual({ enviar: false, motivo: 'sem_telefone' });
    expect(decidir({ paciente: { ...PACIENTE, telefone: '123' } })).toEqual({ enviar: false, motivo: 'sem_telefone' });
  });

  it('sem conta remetente não sai', () => {
    expect(decidir({ remetenteId: null })).toEqual({ enviar: false, motivo: 'sem_remetente' });
  });

  it('já avisado não repete; sem como saber, não envia', () => {
    expect(decidir({ jaNotificado: true })).toEqual({ enviar: false, motivo: 'ja_notificado' });
    expect(decidir({ jaNotificado: 'indisponivel' })).toEqual({ enviar: false, motivo: 'verificacao_indisponivel' });
  });
});

describe('aviso ao cliente: quem pode pedir', () => {
  const REVISOR = 'a0000000-0000-4000-8000-0000000000aa';
  const OUTRO = 'a0000000-0000-4000-8000-0000000000bb';

  it('o revisor que decidiu o plano pede o aviso', () => {
    expect(chamadorPodeAvisar({ chamadorId: REVISOR, revisorId: REVISOR, ehSuperAdmin: false })).toBe(true);
  });

  it('o administrador pede o aviso de qualquer plano decidido', () => {
    expect(chamadorPodeAvisar({ chamadorId: OUTRO, revisorId: REVISOR, ehSuperAdmin: true })).toBe(true);
    expect(chamadorPodeAvisar({ chamadorId: OUTRO, revisorId: null, ehSuperAdmin: true })).toBe(true);
  });

  it('outro membro da equipe não dispara mensagem de um plano que não decidiu', () => {
    expect(chamadorPodeAvisar({ chamadorId: OUTRO, revisorId: REVISOR, ehSuperAdmin: false })).toBe(false);
  });

  it('plano sem revisor registrado: só o administrador', () => {
    expect(chamadorPodeAvisar({ chamadorId: OUTRO, revisorId: null, ehSuperAdmin: false })).toBe(false);
    expect(chamadorPodeAvisar({ chamadorId: OUTRO, revisorId: undefined, ehSuperAdmin: false })).toBe(false);
  });
});
