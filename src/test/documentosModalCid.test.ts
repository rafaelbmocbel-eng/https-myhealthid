import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// A data do diagnóstico agora é opcional (o cartão de CID grava null quando vazia). O CID que o atestado sugere ao abrir
// precisa ser o último CADASTRADO: ordenar pela data iria jogar um CID novo, sem data, para o fim da fila.
describe('atestado: o CID sugerido é o último cadastrado', () => {
  const fonte = readFileSync(join(process.cwd(), 'src/components/documentos/DocumentosModal.tsx'), 'utf8');
  const consulta = fonte.slice(fonte.indexOf(".from('diagnosticos_paciente')"), fonte.indexOf(".maybeSingle()", fonte.indexOf(".from('diagnosticos_paciente')")));

  it('ordena pelo created_at, do mais novo para o mais antigo, e não pela data do diagnóstico', () => {
    expect(consulta).toContain(".order('created_at', { ascending: false })");
    expect(consulta).not.toContain(".order('data_diagnostico'");
    expect(consulta).toContain(".eq('ativo', true)");
  });
});
