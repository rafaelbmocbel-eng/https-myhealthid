import { describe, it, expect, vi } from 'vitest';

// Mock o helper de logo (depende do DOM/canvas)
vi.mock('@/utils/pdfLogoHelper', () => ({
  addLogoToDoc: vi.fn(async () => {}),
}));

import {
  gerarComparecimento,
  gerarAtestadoFisio,
  gerarDeclaracaoTratamento,
  gerarRecibo,
} from '@/utils/pdfDocumentos';

const base = {
  clinica: {
    razao_social: 'Clínica Teste',
    cnpj: '00.000.000/0001-00',
    cidade: 'São Paulo',
    uf: 'SP',
  },
  terapeuta: {
    nome: 'Dr. Fulano',
    sobrenome: 'Silva',
    registro: 'CREFITO 12345-F',
    especialidade: 'Fisioterapia',
  },
  paciente: { nome: 'Ismael', sobrenome: 'Souza', cpf: '123.456.789-00' },
};

describe('Documentos PDF', () => {
  it('gera Atestado de Comparecimento', async () => {
    const doc = await gerarComparecimento({ ...base, dados: { data: '2026-05-06', horaEntrada: '09:00', horaSaida: '10:00' } });
    expect(doc).toBeDefined();
    const bytes = (doc.output('arraybuffer') as ArrayBuffer).byteLength;
    expect(bytes).toBeGreaterThan(500);
  });

  it('gera Atestado Fisioterapêutico', async () => {
    const doc = await gerarAtestadoFisio({ ...base, dados: { diasAfastamento: 3, dataInicio: '2026-05-06', cid: 'M54.5' } });
    const bytes = (doc.output('arraybuffer') as ArrayBuffer).byteLength;
    expect(bytes).toBeGreaterThan(500);
  });

  it('gera Declaração de Tratamento', async () => {
    const doc = await gerarDeclaracaoTratamento({ ...base, dados: { desde: '2026-01-01', finalidade: 'reembolso plano' } });
    const bytes = (doc.output('arraybuffer') as ArrayBuffer).byteLength;
    expect(bytes).toBeGreaterThan(500);
  });

  it('gera Recibo de Pagamento', async () => {
    const doc = await gerarRecibo({ ...base, dados: { valor: 350, referente: 'sessões de fisioterapia', formaPagamento: 'PIX', numeroSessoes: 4 } });
    const bytes = (doc.output('arraybuffer') as ArrayBuffer).byteLength;
    expect(bytes).toBeGreaterThan(500);
  });
});
