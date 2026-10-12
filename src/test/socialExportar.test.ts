import { describe, expect, it, vi } from 'vitest';
import { AVISO_CONSELHO, DICA_TITULO_SEM_PACIENTE, TEXTO_CONSENTIMENTO, podeExportar } from '@/lib/social/consentimento';
import { canvasParaPngSincrono, compartilharArquivo, dataParaArquivo, nomeArquivoSocial, podeCompartilharArquivo } from '@/lib/social/exportar';

const arquivo = () => new File([new Uint8Array([1, 2, 3])], 'arte.png', { type: 'image/png' });

describe('portão de consentimento', () => {
  it('usa o texto e o aviso combinados', () => {
    expect(TEXTO_CONSENTIMENTO).toBe('O paciente autorizou por escrito o uso da imagem para divulgação');
    expect(AVISO_CONSELHO).toMatch(/A publicidade em saúde deve seguir as normas do seu conselho profissional/);
    expect(DICA_TITULO_SEM_PACIENTE).toMatch(/nome do paciente/i);
  });

  it('só libera baixar e compartilhar com a autorização marcada e sem outra geração em andamento', () => {
    expect(podeExportar(false)).toBe(false);
    expect(podeExportar(true)).toBe(true);
    expect(podeExportar(true, true)).toBe(false);
    expect(podeExportar(false, true)).toBe(false);
    // @ts-expect-error -- valor truthy que não seja o booleano true não conta como autorização
    expect(podeExportar('sim')).toBe(false);
  });

  it('com o rosto sem conferir (não localizado), segue travado mesmo com a autorização', () => {
    expect(podeExportar(true, false, true)).toBe(false);
    expect(podeExportar(true, false, false)).toBe(true);
  });
});

describe('nome do arquivo', () => {
  it('traz só o tipo, o formato e a data (fuso de São Paulo), nunca dados do paciente', () => {
    const d = new Date('2026-10-12T15:00:00Z');
    expect(dataParaArquivo(d)).toBe('2026-10-12');
    expect(nomeArquivoSocial('story', 'empilhada', d)).toBe('antes-depois-story-2026-10-12.png');
    expect(nomeArquivoSocial('feed', 'lado_a_lado', d)).toBe('antes-depois-feed-2026-10-12.png');
    expect(nomeArquivoSocial('quadrado', 'unica', d)).toBe('analise-postural-quadrado-2026-10-12.png');
    expect(nomeArquivoSocial('story', 'unica', d, 'jpg')).toMatch(/\.jpg$/);
  });

  it('usa o dia de São Paulo mesmo quando em UTC já virou o dia seguinte', () => {
    expect(dataParaArquivo(new Date('2026-10-13T01:30:00Z'))).toBe('2026-10-12');
  });
});

describe('compartilhar pela Web Share API', () => {
  it('não está disponível sem navigator.share ou canShare', () => {
    expect(podeCompartilharArquivo(arquivo(), {} as Navigator)).toBe(false);
    expect(podeCompartilharArquivo(arquivo(), { share: vi.fn() } as unknown as Navigator)).toBe(false);
    expect(podeCompartilharArquivo(arquivo(), undefined)).toBe(false);
  });

  it('não está disponível quando o navegador recusa arquivos ou lança erro', () => {
    expect(podeCompartilharArquivo(arquivo(), { share: vi.fn(), canShare: () => false } as unknown as Navigator)).toBe(false);
    expect(podeCompartilharArquivo(arquivo(), { share: vi.fn(), canShare: () => { throw new Error('x'); } } as unknown as Navigator)).toBe(false);
  });

  it('envia só o arquivo, sem título nem texto', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const f = arquivo();
    const r = await compartilharArquivo(f, { share, canShare: () => true } as unknown as Navigator);
    expect(r).toBe('compartilhado');
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0]).toEqual({ files: [f] });
  });

  it('cancelar a folha de compartilhamento não é erro nem pede download', async () => {
    const abort = Object.assign(new Error('cancelado'), { name: 'AbortError' });
    const r = await compartilharArquivo(arquivo(), { share: vi.fn().mockRejectedValue(abort), canShare: () => true } as unknown as Navigator);
    expect(r).toBe('cancelado');
  });

  it('qualquer outra falha cai no download', async () => {
    const r = await compartilharArquivo(arquivo(), { share: vi.fn().mockRejectedValue(new Error('NotAllowedError')), canShare: () => true } as unknown as Navigator);
    expect(r).toBe('indisponivel');
    expect(await compartilharArquivo(arquivo(), {} as Navigator)).toBe('indisponivel');
  });

  it('recusa por falta de gesto (NotAllowedError) não é "aparelho sem compartilhamento": pede para tocar de novo', async () => {
    const recusa = Object.assign(new Error('sem gesto'), { name: 'NotAllowedError' });
    const r = await compartilharArquivo(arquivo(), { share: vi.fn().mockRejectedValue(recusa), canShare: () => true } as unknown as Navigator);
    expect(r).toBe('bloqueado');
  });

  it('chama o share na mesma tarefa, antes de qualquer espera', () => {
    const share = vi.fn().mockResolvedValue(undefined);
    void compartilharArquivo(arquivo(), { share, canShare: () => true } as unknown as Navigator);
    expect(share).toHaveBeenCalledTimes(1);
  });
});

describe('PNG sem esperar', () => {
  it('decodifica o data URL do canvas em um Blob image/png com os mesmos bytes', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128]);
    const base64 = btoa(String.fromCharCode(...bytes));
    const cv = { toDataURL: vi.fn(() => `data:image/png;base64,${base64}`) } as unknown as HTMLCanvasElement;
    const blob = canvasParaPngSincrono(cv);
    expect(blob.type).toBe('image/png');
    const lido = await new Promise<ArrayBuffer>((ok, falha) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(leitor.result as ArrayBuffer);
      leitor.onerror = () => falha(leitor.error);
      leitor.readAsArrayBuffer(blob);
    });
    expect(new Uint8Array(lido)).toEqual(bytes);
  });

  it('canvas que não gera imagem dá erro em vez de um arquivo vazio', () => {
    const cv = { toDataURL: () => 'data:,' } as unknown as HTMLCanvasElement;
    expect(() => canvasParaPngSincrono(cv)).toThrow();
  });
});
