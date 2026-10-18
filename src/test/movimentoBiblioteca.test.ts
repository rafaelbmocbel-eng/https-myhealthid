import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BIBLIOTECA, CHAVES_ACHADO, entradaDaBiblioteca, termoProibido, type EntradaBiblioteca, type FonteBiblio } from '../lib/angular/movimento';
import { AVALIACAO, ITENS_PRIMARIO, ITENS_REVISAO, ROTULO_DECISAO } from '../lib/angular/movimento/biblioteca/avaliacaoMetodologica';
import { FONTES } from '../lib/angular/movimento/biblioteca/fontes';
import { textoQualidade } from '../lib/angular/movimento/frases';

/*
 * Biblioteca de hipóteses (agentes R e R2). O teste confere por máquina o que dá: estrutura das fontes, consistência entre repetições do
 * mesmo PMID, força × fonte, vocabulário, ausência de verbo causal e caracteres que o PDF imprime. Que o trecho é cópia literal do
 * resumo só se confere contra o PubMed (feito na curadoria, em docs/biblioteca-hipoteses-movimento.md). A re-curadoria metodológica (R2) acrescenta:
 * toda fonte tem avaliação, nenhuma fonte removida é citada, fator com força tem fonte retida, qualidade baixa nunca aparece sem ressalva e o
 * documento docs/avaliacao-metodologica-fontes.md bate com os dados.
 */

const PDF_SEGURO = new RegExp('^[\\x20-\\x7E\\u00A0-\\u00FF≥≤−–—·→“”‘’]*$');

/** Verbos e expressões que afirmam causa ou diagnóstico: a biblioteca só pode falar em associação e em hipótese. */
const VERBO_CAUSAL =
  /\b(causa|causam|causou|causando|provoca|provocam|provocou|diagnostica|diagnosticam|determina|determinam|origina|originam|gera|geram|induz|induzem|resulta|resultam|resultou|leva a|levam a|levou a|responsável por|devido a)\b/i;

const MARCA_DE_HIPOTESE = /(associad|pode(m)? (contribuir|refletir|divergir|estar)|hipótese|interpretad|discutid|relacion|correlacion)/i;

const entradas = (): [string, EntradaBiblioteca][] => Object.entries(BIBLIOTECA);

function fontesDaBiblioteca(): FonteBiblio[] {
  const todas: FonteBiblio[] = [];
  for (const [, e] of entradas()) {
    for (const f of e.fatores) todas.push(...f.fontes);
    for (const c of e.conferir) {
      if (c.fonte) todas.push(c.fonte);
    }
  }
  return todas;
}

/** Todo texto que o laudo pode imprimir (inclusive o trecho em inglês, a citação e a população). */
function textosImpressos(e: EntradaBiblioteca): string[] {
  const saida: string[] = [e.titulo];
  for (const f of e.fatores) {
    saida.push(f.texto, f.ressalva);
    for (const s of f.fontes) saida.push(s.citacao, s.periodico, s.trecho, s.populacao ?? '', s.limitacaoPrincipal ?? '', textoQualidade(s) ?? '');
  }
  for (const c of e.conferir) {
    saida.push(c.texto);
    if (c.fonte) saida.push(c.fonte.citacao, c.fonte.periodico, c.fonte.trecho, c.fonte.populacao ?? '', c.fonte.limitacaoPrincipal ?? '');
  }
  return saida;
}

/** O que é redigido por nós, em português: o trecho em inglês é citação literal e não entra na checagem de vocabulário. */
function textosProprios(e: EntradaBiblioteca): string[] {
  const limitacoes = [...e.fatores.flatMap((f) => f.fontes), ...e.conferir.flatMap((c) => (c.fonte ? [c.fonte] : []))].map((s) => s.limitacaoPrincipal ?? '');
  return [e.titulo, ...e.fatores.flatMap((f) => [f.texto, f.ressalva]), ...e.conferir.map((c) => c.texto), ...limitacoes];
}

describe('biblioteca de hipóteses: cobertura', () => {
  it('tem uma entrada para cada uma das 13 chaves do catálogo, e a chave do registro repete a da entrada', () => {
    expect(CHAVES_ACHADO).toHaveLength(13);
    for (const chave of CHAVES_ACHADO) {
      const e = entradaDaBiblioteca(chave);
      expect(e, chave).not.toBeNull();
      expect(e?.chave, chave).toBe(chave);
      expect(BIBLIOTECA[chave], chave).toBe(e);
    }
    expect(Object.keys(BIBLIOTECA).sort()).toEqual([...CHAVES_ACHADO].sort());
  });

  it('não devolve entrada para chave ausente nem para nomes herdados do objeto', () => {
    for (const nome of ['inventado', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(entradaDaBiblioteca(nome), nome).toBeNull();
  });

  it('cada entrada tem título, ao menos um item a conferir e ids de fator únicos', () => {
    for (const [chave, e] of entradas()) {
      expect(e.titulo.trim().length, chave).toBeGreaterThan(0);
      expect(e.conferir.length, chave).toBeGreaterThan(0);
      const ids = e.fatores.map((f) => f.id);
      expect(new Set(ids).size, `${chave}: ids repetidos`).toBe(ids.length);
      for (const id of ids) expect(id, `${chave}:${id}`).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe('biblioteca de hipóteses: fontes', () => {
  it('toda fonte tem PMID numérico, citação, ano, periódico, trecho, população e data de conferência', () => {
    const todas = fontesDaBiblioteca();
    expect(todas.length).toBeGreaterThan(30);
    for (const f of todas) {
      const rotulo = `PMID ${f.pmid}`;
      expect(f.pmid, rotulo).toMatch(/^\d+$/);
      expect(f.citacao.trim().length, rotulo).toBeGreaterThan(30);
      expect(f.periodico.trim().length, rotulo).toBeGreaterThan(1);
      expect(f.ano, rotulo).toBeGreaterThanOrEqual(1980);
      expect(f.ano, rotulo).toBeLessThanOrEqual(2026);
      expect(f.citacao, rotulo).toContain(String(f.ano));
      expect(f.trecho.trim().length, rotulo).toBeGreaterThan(20);
      expect((f.populacao ?? '').trim().length, rotulo).toBeGreaterThan(5);
      expect(f.verificadoEm ?? '', rotulo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (f.doi !== undefined) expect(f.doi, rotulo).toMatch(/^10\.\d{4,9}\/\S+$/);
    }
  });

  it('o trecho é um recorte de resumo em inglês, sem reticências nem colchetes de edição', () => {
    for (const f of fontesDaBiblioteca()) {
      expect(f.trecho, `PMID ${f.pmid}`).not.toMatch(/…|\.\.\./);
      expect(f.trecho, `PMID ${f.pmid}`).toMatch(/[A-Za-z]{3,}/);
    }
  });

  it('o mesmo PMID nunca aparece com dados divergentes', () => {
    const porPmid = new Map<string, FonteBiblio>();
    for (const f of fontesDaBiblioteca()) {
      const anterior = porPmid.get(f.pmid);
      if (anterior) expect(f, `PMID ${f.pmid}`).toEqual(anterior);
      else porPmid.set(f.pmid, f);
    }
    const pmids = Object.values(FONTES).map((f) => f.pmid);
    expect(new Set(pmids).size, 'PMID repetido em fontes.ts').toBe(pmids.length);
  });

  it('toda fonte registrada em fontes.ts é usada por algum fator ou item a conferir', () => {
    const usados = new Set(fontesDaBiblioteca().map((f) => f.pmid));
    for (const [id, f] of Object.entries(FONTES)) expect(usados.has(f.pmid), `${id} (PMID ${f.pmid}) sem uso`).toBe(true);
  });
});

describe('biblioteca de hipóteses: fatores e itens a conferir', () => {
  it('fator com força diferente de "a confirmar" tem fonte; "a confirmar" não cita fonte e diz que não há referência verificada', () => {
    for (const [chave, e] of entradas()) {
      for (const f of e.fatores) {
        const rotulo = `${chave}:${f.id}`;
        expect(f.ressalva.trim().length, rotulo).toBeGreaterThan(20);
        if (f.forca === 'a_confirmar') {
          expect(f.fontes, rotulo).toHaveLength(0);
          expect(f.ressalva, rotulo).toMatch(/sem referência verificada/i);
        } else {
          expect(f.fontes.length, rotulo).toBeGreaterThan(0);
        }
      }
    }
  });

  it('o rótulo de força combina com o tipo de estudo declarado na população da fonte principal', () => {
    for (const [chave, e] of entradas()) {
      for (const f of e.fatores) {
        if (f.forca === 'revisao_sistematica' || f.forca === 'meta_analise') {
          const temRevisao = f.fontes.some((s) => /^Revisão sistemática/.test(s.populacao ?? ''));
          expect(temRevisao, `${chave}:${f.id} declara revisão sem fonte que seja revisão`).toBe(true);
        }
        if (f.forca === 'meta_analise') {
          const temMeta = f.fontes.some((s) => /metanálise/i.test(s.populacao ?? ''));
          expect(temMeta, `${chave}:${f.id} declara metanálise sem fonte com metanálise`).toBe(true);
        }
      }
    }
  });

  it('todo item a conferir tem fonte ou declara "sem referência verificada", nunca os dois', () => {
    for (const [chave, e] of entradas()) {
      for (const c of e.conferir) {
        const rotulo = `${chave}: ${c.texto}`;
        const temFonte = c.fonte !== undefined;
        const semRef = c.semReferenciaVerificada === true;
        expect(temFonte || semRef, rotulo).toBe(true);
        expect(temFonte && semRef, rotulo).toBe(false);
        expect(c.texto.trim().length, rotulo).toBeGreaterThan(15);
      }
    }
  });

  it('o texto de cada fator é redigido como hipótese ou associação', () => {
    for (const [chave, e] of entradas()) {
      for (const f of e.fatores) expect(f.texto, `${chave}:${f.id}`).toMatch(MARCA_DE_HIPOTESE);
    }
  });
});

describe('biblioteca de hipóteses: linguagem', () => {
  it('nenhum texto redigido julga o corpo ou o desempenho (certo, errado, normal, perfeito, falha...)', () => {
    for (const [, e] of entradas()) {
      for (const s of textosProprios(e)) expect(termoProibido(s), s).toBeNull();
    }
  });

  it('nenhum texto redigido afirma causa ou diagnóstico', () => {
    for (const [, e] of entradas()) {
      for (const s of textosProprios(e)) expect(s, s).not.toMatch(VERBO_CAUSAL);
    }
  });

  it('o detector de verbo causal pega o que deve e deixa passar associação e "causalidade"', () => {
    for (const s of ['isso causa dor', 'o valgo provoca lesão', 'o déficit determina o desvio', 'devido a fraqueza']) expect(s, s).toMatch(VERBO_CAUSAL);
    for (const s of ['foi associado a menor flexão', 'não estabelece causalidade', 'pode contribuir para a diferença']) expect(s, s).not.toMatch(VERBO_CAUSAL);
  });

  it('todo texto impresso usa só caracteres que o gerador de PDF imprime', () => {
    for (const [chave, e] of entradas()) {
      for (const s of textosImpressos(e)) expect(PDF_SEGURO.test(s), `${chave}: ${s}`).toBe(true);
    }
  });

  it('o avanço do joelho continua como observação medida: a biblioteca registra o debate e não propõe limite', () => {
    const e = entradaDaBiblioteca('avanco_joelho');
    expect(e).not.toBeNull();
    const texto = (e?.fatores ?? []).map((f) => `${f.texto} ${f.ressalva}`).join(' ');
    expect(texto).toMatch(/debatido/);
    expect(texto).toMatch(/sem critério ativado/);
    expect((e?.conferir ?? []).map((c) => c.texto).join(' ')).toMatch(/não define limite/);
  });
});

describe('documento de curadoria', () => {
  const DOC = readFileSync(resolve(process.cwd(), 'docs/biblioteca-hipoteses-movimento.md'), 'utf8');

  it('lista cada chave do catálogo', () => {
    for (const chave of CHAVES_ACHADO) expect(DOC, chave).toContain(`\`${chave}\``);
  });

  it('cita cada fonte usada com PMID e DOI', () => {
    for (const f of fontesDaBiblioteca()) {
      expect(DOC, `PMID ${f.pmid}`).toContain(`PMID ${f.pmid}`);
      if (f.doi) expect(DOC, `DOI ${f.doi}`).toContain(f.doi);
    }
  });

  it('diz o que ficou sem referência verificada', () => {
    expect(DOC).toMatch(/sem referência verificada/i);
  });
});

describe('avaliação metodológica das fontes (R2)', () => {
  const usados = () => new Set(fontesDaBiblioteca().map((f) => f.pmid));
  const retidos = () => new Set(Object.values(FONTES).map((f) => f.pmid));
  const CRITICOS_REVISAO = ['protocolo', 'busca', 'risco_de_vies', 'sintese'] as const;
  const CRITICOS_PRIMARIO = ['amostra', 'medida', 'confundidores', 'comparacoes_multiplas'] as const;

  it('toda fonte da biblioteca tem avaliação, e a fonte leva a qualidade e a limitação principal da avaliação', () => {
    for (const [id, f] of Object.entries(FONTES)) {
      const a = AVALIACAO[f.pmid];
      expect(a, `${id} (PMID ${f.pmid}) sem avaliação metodológica`).toBeDefined();
      expect(f.qualidade, id).toBe(a?.nivelQualidade);
      expect(f.limitacaoPrincipal, id).toBe(a?.limitacaoPrincipal);
    }
    for (const f of fontesDaBiblioteca()) expect(AVALIACAO[f.pmid], `PMID ${f.pmid} citado sem avaliação`).toBeDefined();
  });

  it('nenhuma fonte com decisão "remover" é referenciada nem fica em fontes.ts; toda fonte retida está em fontes.ts', () => {
    for (const [pmid, a] of Object.entries(AVALIACAO)) {
      const rotulo = `${a.rotulo} (PMID ${pmid})`;
      if (a.decisao === 'remover') {
        expect(usados().has(pmid), `${rotulo} removida, mas citada`).toBe(false);
        expect(retidos().has(pmid), `${rotulo} removida, mas ainda em fontes.ts`).toBe(false);
      } else {
        expect(retidos().has(pmid), `${rotulo} mantida, mas ausente de fontes.ts`).toBe(true);
      }
    }
  });

  it('fator com força diferente de "a confirmar" tem ao menos uma fonte retida (qualidade alta ou moderada, ou baixa com ressalva)', () => {
    for (const [chave, e] of entradas()) {
      for (const f of e.fatores) {
        if (f.forca === 'a_confirmar') continue;
        const rotulo = `${chave}:${f.id}`;
        expect(f.fontes.length, rotulo).toBeGreaterThan(0);
        for (const s of f.fontes) expect(AVALIACAO[s.pmid]?.decisao, `${rotulo}: PMID ${s.pmid}`).not.toBe('remover');
        expect(f.fontes.some((s) => s.qualidade === 'alta' || s.qualidade === 'moderada' || AVALIACAO[s.pmid]?.decisao === 'manter_com_ressalva'), rotulo).toBe(true);
      }
    }
  });

  it('item a conferir com fonte aponta para fonte retida; sem fonte declara "sem referência verificada"', () => {
    for (const [chave, e] of entradas()) {
      for (const c of e.conferir) {
        if (c.fonte) expect(AVALIACAO[c.fonte.pmid]?.decisao, `${chave}: ${c.texto}`).not.toBe('remover');
        else expect(c.semReferenciaVerificada, `${chave}: ${c.texto}`).toBe(true);
      }
    }
  });

  it('qualidade baixa nunca aparece sem ressalva: só com decisão "manter com ressalva" (ou removida), limitação principal e ressalva longa no fator', () => {
    for (const [pmid, a] of Object.entries(AVALIACAO)) {
      if (a.nivelQualidade !== 'baixa') continue;
      expect(['manter_com_ressalva', 'remover'], `${a.rotulo} (PMID ${pmid})`).toContain(a.decisao);
    }
    for (const [chave, e] of entradas()) {
      for (const f of e.fatores) {
        if (f.fontes.some((s) => s.qualidade === 'baixa')) {
          expect(f.ressalva.length, `${chave}:${f.id}`).toBeGreaterThan(120);
          for (const s of f.fontes.filter((x) => x.qualidade === 'baixa')) expect((s.limitacaoPrincipal ?? '').length, `PMID ${s.pmid}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it('as regras de decisão se sustentam: "manter" exige aplicabilidade direta e qualidade que não seja baixa; texto só pelo resumo nunca é "alta"; "alta" exige os itens críticos atendidos', () => {
    for (const [pmid, a] of Object.entries(AVALIACAO)) {
      const rotulo = `${a.rotulo} (PMID ${pmid})`;
      if (a.decisao === 'manter') {
        expect(a.aplicabilidade.grau, rotulo).toBe('direta');
        expect(a.nivelQualidade, rotulo).not.toBe('baixa');
      }
      if (a.lido === 'resumo') expect(a.nivelQualidade, `${rotulo}: só resumo`).not.toBe('alta');
      if (a.nivelQualidade === 'alta') {
        const itens = a.itens as Record<string, readonly [string, string?]>;
        for (const k of a.tipo === 'revisao' ? CRITICOS_REVISAO : CRITICOS_PRIMARIO) expect(itens[k][0], `${rotulo}: ${k}`).toBe('atende');
      }
      if (a.aplicabilidade.grau === 'indireta') expect(a.decisao === 'remover' || a.decisao === 'manter_com_ressalva', rotulo).toBe(true);
    }
  });

  it('cada avaliação traz todos os itens do desenho, desenho, limitações, aplicabilidade e justificativa', () => {
    for (const [pmid, a] of Object.entries(AVALIACAO)) {
      const rotulo = `${a.rotulo} (PMID ${pmid})`;
      expect(pmid, rotulo).toMatch(/^\d+$/);
      const itens = a.itens as Record<string, readonly [string, string?]>;
      for (const k of [...(a.tipo === 'revisao' ? ITENS_REVISAO : ITENS_PRIMARIO), 'veiculo']) {
        expect(itens[k], `${rotulo}: item ${k}`).toBeDefined();
        expect(['atende', 'parcialmente', 'nao_atende', 'nao_avaliavel'], `${rotulo}: item ${k}`).toContain(itens[k][0]);
      }
      expect(a.desenho.trim().length, rotulo).toBeGreaterThan(20);
      expect(a.limitacoes.length, rotulo).toBeGreaterThan(0);
      expect(a.aplicabilidade.nota.trim().length, rotulo).toBeGreaterThan(20);
      expect(a.justificativa.trim().length, rotulo).toBeGreaterThan(30);
      expect(a.limitacaoPrincipal.trim().length, rotulo).toBeGreaterThan(20);
    }
  });

  it('o texto exibido no laudo (qualidade e limitação principal) aparece na fonte retida, e fonte sem avaliação não mostra nada', () => {
    const f = FONTES.lopes2018;
    expect(textoQualidade(f)).toBe(`Qualidade metodológica: moderada. Limitação principal: ${f.limitacaoPrincipal}`);
    expect(textoQualidade({ ...f, qualidade: undefined, limitacaoPrincipal: undefined })).toBeNull();
    expect(textoQualidade({ ...f, limitacaoPrincipal: undefined })).toBe('Qualidade metodológica: moderada.');
    for (const fonte of Object.values(FONTES)) expect(textoQualidade(fonte), `PMID ${fonte.pmid}`).toMatch(/^Qualidade metodológica: (alta|moderada|baixa)\. Limitação principal: .+\.$/);
  });

  it('a limitação principal e o texto de qualidade são redigidos sem verbo causal nem juízo sobre o corpo e usam só caracteres que o PDF imprime', () => {
    for (const a of Object.values(AVALIACAO)) {
      expect(termoProibido(a.limitacaoPrincipal), a.limitacaoPrincipal).toBeNull();
      expect(a.limitacaoPrincipal, a.limitacaoPrincipal).not.toMatch(VERBO_CAUSAL);
      expect(PDF_SEGURO.test(a.limitacaoPrincipal), a.limitacaoPrincipal).toBe(true);
    }
  });
});

describe('documento da avaliação metodológica', () => {
  const DOC = readFileSync(resolve(process.cwd(), 'docs/avaliacao-metodologica-fontes.md'), 'utf8');
  const total = Object.keys(AVALIACAO).length;
  const por = (d: string) => Object.values(AVALIACAO).filter((a) => a.decisao === d).length;

  it('escreve os critérios antes do resultado e cobre os itens (a) a (f)', () => {
    const criterios = DOC.indexOf('## Critérios');
    expect(criterios).toBeGreaterThan(-1);
    expect(criterios).toBeLessThan(DOC.indexOf('## Resultado'));
    for (const trecho of ['### (a) Desenho e hierarquia', '### (b) Revisões sistemáticas', '### (c) Estudos primários', '### (d) Aplicabilidade', '### (e) Consistência', '### (f) Veículo']) {
      expect(DOC, trecho).toContain(trecho);
    }
    expect(DOC).toMatch(/não avaliável/);
  });

  it('traz uma linha por PMID avaliado, com a decisão dos dados, e os números do resumo batem', () => {
    const linhas = DOC.split('\n');
    for (const [pmid, a] of Object.entries(AVALIACAO)) {
      const linha = linhas.find((l) => l.startsWith('| **') && l.includes(`PMID ${pmid})`));
      expect(linha, `${a.rotulo} (PMID ${pmid}) sem linha no quadro`).toBeDefined();
      expect(linha, a.rotulo).toContain(` | ${ROTULO_DECISAO[a.decisao]} | `);
    }
    expect(DOC).toContain(`Foram avaliadas **${total} fontes**`);
    expect(DOC).toContain(`| manter | ${por('manter')} |`);
    expect(DOC).toContain(`| manter com ressalva | ${por('manter_com_ressalva')} |`);
    expect(DOC).toContain(`| remover | ${por('remover')} |`);
    expect(DOC).toContain(`**Mantidas: ${por('manter') + por('manter_com_ressalva')}**`);
    const fatores = Object.values(BIBLIOTECA).flatMap((e) => e.fatores);
    expect(DOC).toContain(`depois **${fatores.length}** (${fatores.filter((f) => f.forca !== 'a_confirmar').length} com fonte e **${fatores.filter((f) => f.forca === 'a_confirmar').length} a confirmar**)`);
  });

  it('lista, no documento da biblioteca, a qualidade metodológica de cada fonte retida', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/biblioteca-hipoteses-movimento.md'), 'utf8');
    for (const f of Object.values(FONTES)) {
      expect(doc, `PMID ${f.pmid}`).toContain(`PMID ${f.pmid}`);
      expect(doc, `PMID ${f.pmid}`).toContain(`Qualidade metodológica: ${f.qualidade}`);
    }
  });
});
