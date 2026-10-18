import { describe, expect, it } from 'vitest';
import {
  AVISO_REFERENCIAS, classificarContraReferencia, descreverFaixa, montarCartao, montarCartoes, referenciasDaMetrica, REFERENCIAS,
  type ReferenciaBiomecanica,
} from '../lib/angular/video/referencias';
import { MODELOS_GESTO } from '../lib/angular/video/modelos';
import type { ResultadoMetrica } from '../lib/angular/video/tipos';

const confirmadas = REFERENCIAS.filter((r) => r.estatuto === 'confirmada');
const semReferencia = REFERENCIAS.filter((r) => r.estatuto === 'sem_referencia');

const resultado = (metrica: string, valor: number | null, extra: Partial<ResultadoMetrica> = {}): ResultadoMetrica => ({
  id: metrica, metrica, nome: metrica, valor, unidade: '', lado: null, avisos: [], ...extra,
});

describe('tabela de referências: só o que foi verificado em fonte real', () => {
  it('a lista de métricas com faixa confirmada é fechada: incluir uma nova exige conferir a fonte e atualizar este teste', () => {
    expect(confirmadas.map((r) => r.chave).sort()).toEqual(['cadencia.tudor2018', 'velocidade_marcha.bohannon1997', 'velocidade_marcha.bohannon2011']);
  });

  it('toda referência confirmada traz autor, ano, periódico, PMID, DOI e o trecho original de onde o número foi lido', () => {
    for (const r of confirmadas) {
      expect(r.fonte.pmid, r.chave).toMatch(/^\d{6,9}$/);
      expect(r.fonte.doi, r.chave).toMatch(/^10\.\d{4,}\//);
      expect(r.fonte.citacao, r.chave).toMatch(/\b(19|20)\d{2}\b/);
      expect(r.fonte.citacao.length, r.chave).toBeGreaterThan(40);
      expect(r.fonte.trecho, r.chave).toBeTruthy();
      expect(r.populacao.length, r.chave).toBeGreaterThan(10);
      expect(r.unidade, r.chave).toBeTruthy();
      expect(r.tipo, r.chave).toBeTruthy();
      expect(r.nota, r.chave).toBeTruthy();
    }
  });

  it('cada limite da faixa aparece, escrito igual, no trecho original da fonte', () => {
    for (const r of confirmadas) {
      const { min, max } = r.faixa;
      expect(min !== undefined || max !== undefined, r.chave).toBe(true);
      for (const limite of [min, max]) if (limite !== undefined) expect(r.fonte.trecho, `${r.chave}: ${limite}`).toContain(String(limite));
    }
  });

  it('o que não foi confirmado fica sem faixa e sem classificar, mas pode trazer o que a literatura verificada relata (com PMID e trecho)', () => {
    expect(semReferencia.length).toBeGreaterThan(5);
    for (const r of semReferencia) {
      expect(r.faixa, r.chave).toEqual({});
      expect(r.fonte.pmid, r.chave).toBeUndefined();
      expect(classificarContraReferencia(50, r), r.chave).toBe('sem_referencia');
      for (const c of r.contexto ?? []) {
        expect(c.fonte.pmid, r.chave).toMatch(/^\d{6,9}$/);
        expect(c.fonte.trecho, r.chave).toBeTruthy();
        expect(c.texto.length, r.chave).toBeGreaterThan(30);
      }
    }
  });

  it('chaves únicas e toda referência aponta para uma métrica que algum modelo calcula', () => {
    expect(new Set(REFERENCIAS.map((r) => r.chave)).size).toBe(REFERENCIAS.length);
    for (const r of REFERENCIAS) {
      const gestos = MODELOS_GESTO.filter((m) => m.metricas.some((d) => d.metrica === r.metrica));
      expect(gestos.length, `${r.chave}: nenhum modelo calcula ${r.metrica}`).toBeGreaterThan(0);
      for (const g of r.aplicaA ?? []) expect(gestos.map((m) => m.id), r.chave).toContain(g);
    }
  });

  it('os números lidos nas fontes: velocidade confortável 127,2–146,2 cm/s (Bohannon, 1997) e 94,3–143,4 cm/s (Bohannon e Andrews, 2011); cadência ≥ 100 passos/min (Tudor-Locke, 2018)', () => {
    const por = (chave: string) => REFERENCIAS.find((r) => r.chave === chave) as ReferenciaBiomecanica;
    expect(por('velocidade_marcha.bohannon1997').faixa).toEqual({ min: 127.2, max: 146.2 });
    expect(por('velocidade_marcha.bohannon1997').fonte.pmid).toBe('9143432');
    expect(por('velocidade_marcha.bohannon2011').faixa).toEqual({ min: 94.3, max: 143.4 });
    expect(por('velocidade_marcha.bohannon2011').fonte.pmid).toBe('21820535');
    expect(por('cadencia.tudor2018').faixa).toEqual({ min: 100 });
    expect(por('cadencia.tudor2018').fonte.pmid).toBe('29858465');
    expect(por('cadencia.tudor2018').tipo).toBe('limiar_heuristico');
    for (const c of ['velocidade_marcha.bohannon1997', 'velocidade_marcha.bohannon2011']) expect(por(c).tipo).toBe('faixa_de_medias');
  });

  it('a nota de Bohannon e Andrews (2011) traz a inclusão, a ressalva dos autores com o comando "vá" e o aviso sobre trecho curto em vídeo', () => {
    const r = REFERENCIAS.find((x) => x.chave === 'velocidade_marcha.bohannon2011') as ReferenciaBiomecanica;
    const nota = r.nota ?? '';
    // inclusão do resumo no PubMed: adultos aparentemente saudáveis, ritmo normal, percursos de 3 a 30 m
    expect(nota).toMatch(/adultos aparentemente saudáveis/);
    expect(nota).toMatch(/ritmo normal/);
    expect(nota).toMatch(/3 a 30 m/);
    // ressalva dos autores: distâncias curtas a partir do comando 'go' (parado) ou com curva
    expect(nota).toMatch(/distâncias curtas/);
    expect(nota).toMatch(/comando "vá" \(partida parada\)/);
    expect(nota).not.toMatch(/comando de largada/);
    expect(nota).toMatch(/curva/);
    // o que o app acrescenta: o vídeo costuma medir um trecho curto
    expect(nota).toMatch(/velocidade estimada por vídeo costuma vir de um trecho curto/);
    expect(nota).toMatch(/provavelmente se aplica/);
    // a fonte e os números não mudam
    expect(r.fonte.pmid).toBe('21820535');
    expect(r.faixa).toEqual({ min: 94.3, max: 143.4 });
    expect(r.fonte.trecho).toBe('The gait speed was homogeneous within strata and ranged from a mean of 143.4 cm/second for men aged 40 to 49 years to a mean of 94.3 cm/second for women aged 80 to 99 years.');
  });

  it('a ressalva de curta distância é só da fonte que a faz: nenhuma outra referência ganha uma equivalente', () => {
    for (const r of REFERENCIAS.filter((x) => x.chave !== 'velocidade_marcha.bohannon2011')) expect(r.nota ?? '', r.chave).not.toMatch(/comando "vá"|distâncias curtas/);
  });

  it('as notas das referências confirmadas não julgam o paciente (nada de certo, errado, anormal ou perfeito)', () => {
    for (const r of confirmadas) expect(r.nota ?? '', r.chave).not.toMatch(/\b(certo|errado|anormal|perfeito)\b/i);
  });

  it('há um aviso geral sobre comparar vídeo com estudos de outros métodos', () => {
    expect(AVISO_REFERENCIAS).toContain('outros métodos');
    expect(AVISO_REFERENCIAS).toContain('diagnóstico');
  });
});

describe('classificarContraReferencia', () => {
  const ref = (faixa: { min?: number; max?: number }, estatuto: ReferenciaBiomecanica['estatuto'] = 'confirmada'): ReferenciaBiomecanica => ({
    chave: 'x', metrica: 'x', populacao: 'p', faixa, fonte: { citacao: 'c' }, estatuto, unidade: 'u',
  });

  it('dentro e fora, com os limites inclusivos e sem tolerância acrescentada', () => {
    const r = ref({ min: 10, max: 20 });
    expect(classificarContraReferencia(10, r)).toBe('dentro');
    expect(classificarContraReferencia(20, r)).toBe('dentro');
    expect(classificarContraReferencia(15, r)).toBe('dentro');
    expect(classificarContraReferencia(9.999, r)).toBe('fora');
    expect(classificarContraReferencia(20.001, r)).toBe('fora');
  });

  it('faixas abertas de um lado só', () => {
    expect(classificarContraReferencia(100, ref({ min: 100 }))).toBe('dentro');
    expect(classificarContraReferencia(99.9, ref({ min: 100 }))).toBe('fora');
    expect(classificarContraReferencia(1e9, ref({ min: 100 }))).toBe('dentro');
    expect(classificarContraReferencia(5, ref({ max: 5 }))).toBe('dentro');
    expect(classificarContraReferencia(5.1, ref({ max: 5 }))).toBe('fora');
  });

  it('sem referência, sem valor, sem faixa ou com referência não confirmada: sem_referencia', () => {
    expect(classificarContraReferencia(5, null)).toBe('sem_referencia');
    expect(classificarContraReferencia(5, undefined)).toBe('sem_referencia');
    expect(classificarContraReferencia(null, ref({ min: 1, max: 2 }))).toBe('sem_referencia');
    expect(classificarContraReferencia(undefined, ref({ min: 1, max: 2 }))).toBe('sem_referencia');
    expect(classificarContraReferencia(Number.NaN, ref({ min: 1, max: 2 }))).toBe('sem_referencia');
    expect(classificarContraReferencia(5, ref({}))).toBe('sem_referencia');
    expect(classificarContraReferencia(1.5, ref({ min: 1, max: 2 }, 'sem_referencia'))).toBe('sem_referencia');
  });

  it('os valores da literatura para a velocidade confortável: dentro e fora de cada faixa', () => {
    const r97 = REFERENCIAS.find((r) => r.chave === 'velocidade_marcha.bohannon1997');
    const r11 = REFERENCIAS.find((r) => r.chave === 'velocidade_marcha.bohannon2011');
    expect(classificarContraReferencia(130, r97)).toBe('dentro');
    expect(classificarContraReferencia(100, r97)).toBe('fora');
    expect(classificarContraReferencia(100, r11)).toBe('dentro');
    expect(classificarContraReferencia(90, r11)).toBe('fora');
    expect(classificarContraReferencia(150, r11)).toBe('fora');
  });
});

describe('referenciasDaMetrica e montarCartao', () => {
  it('a cadência de 100 passos/min vale só para a marcha; na corrida não há faixa confirmada', () => {
    expect(referenciasDaMetrica('cadencia', 'marcha').filter((r) => r.estatuto === 'confirmada')).toHaveLength(1);
    expect(referenciasDaMetrica('cadencia', 'corrida').filter((r) => r.estatuto === 'confirmada')).toHaveLength(0);
    expect(referenciasDaMetrica('cadencia', 'corrida')).toHaveLength(1);
    expect(referenciasDaMetrica('cadencia')).toHaveLength(2);
    expect(referenciasDaMetrica('nao_existe')).toEqual([]);
  });

  it('cartão com referência: dentro de qualquer faixa confirmada conta como dentro, e o texto traz a fonte e o PMID', () => {
    const c = montarCartao(resultado('velocidade_marcha', 130), 'marcha');
    expect(c.classe).toBe('dentro');
    expect(c.avaliacoes).toHaveLength(2);
    expect(c.avaliacoes.every((a) => a.classe === 'dentro')).toBe(true);
    expect(c.textoReferencia).toContain('Bohannon, 1997');
    expect(c.textoReferencia).toContain('PMID 9143432');
    expect(c.textoReferencia).toContain('Bohannon e Andrews, 2011');
    expect(c.textoReferencia).toContain('127,2 a 146,2 cm/s');
  });

  it('entre as duas faixas fica dentro de uma e fora da outra; fora de todas é fora', () => {
    const meio = montarCartao(resultado('velocidade_marcha', 100), 'marcha');
    expect(meio.avaliacoes.map((a) => a.classe).sort()).toEqual(['dentro', 'fora']);
    expect(meio.classe).toBe('dentro');
    expect(montarCartao(resultado('velocidade_marcha', 80), 'marcha').classe).toBe('fora');
    expect(montarCartao(resultado('cadencia', 90), 'marcha').classe).toBe('fora');
    expect(montarCartao(resultado('cadencia', 100), 'marcha').classe).toBe('dentro');
  });

  it('sem referência confirmada o cartão diz "sem referência" e repassa o contexto da literatura sem classificar', () => {
    const c = montarCartao(resultado('flexao_joelho_pico_apoio', 48), 'corrida');
    expect(c.classe).toBe('sem_referencia');
    expect(c.avaliacoes).toEqual([]);
    expect(c.textoReferencia).toBe('sem referência verificada');
    expect(c.contexto).toHaveLength(1);
    expect(c.contexto[0].fonte.pmid).toBe('26616185');
    expect(c.contexto[0].texto).toContain('45°');
    const sem = montarCartao(resultado('inexistente', 3));
    expect(sem.classe).toBe('sem_referencia');
    expect(sem.contexto).toEqual([]);
  });

  it('resultado sem valor é sem_referencia mesmo havendo faixa', () => {
    const c = montarCartao(resultado('velocidade_marcha', null), 'marcha');
    expect(c.classe).toBe('sem_referencia');
    expect(c.avaliacoes.every((a) => a.classe === 'sem_referencia')).toBe(true);
  });

  it('montarCartoes processa a lista inteira na ordem', () => {
    const cartoes = montarCartoes([resultado('cadencia', 110), resultado('adm_joelho', 60)], 'marcha');
    expect(cartoes.map((c) => c.classe)).toEqual(['dentro', 'sem_referencia']);
    expect(cartoes[1].contexto[0].fonte.pmid).toBe('32491153');
  });

  it('descreverFaixa formata em português com a unidade', () => {
    const r = (f: { min?: number; max?: number }) => ({ faixa: f, unidade: 'cm/s' }) as ReferenciaBiomecanica;
    expect(descreverFaixa(r({ min: 94.3, max: 143.4 }))).toBe('94,3 a 143,4 cm/s');
    expect(descreverFaixa(r({ min: 100 }))).toBe('≥ 100 cm/s');
    expect(descreverFaixa(r({ max: 5 }))).toBe('≤ 5 cm/s');
    expect(descreverFaixa(r({}))).toBe('sem referência verificada');
  });
});
