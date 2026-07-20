import { describe, it, expect } from 'vitest';
import { REGIONS, STRUCTURES } from '@/components/presencial/Body3DAvatar';
import { VISCERAL_REGIONS } from '@/utils/anatomia/regioesViscerais';
import { ZONAS_CORPORAIS, ESTRUTURAS_SISTEMICAS, zonaDeRegiao } from '@/utils/anatomia/pontoAnatomico';
import { MAPEAMENTO_SINTOMAS } from '@/utils/anatomia/mapeamentoSintomas';

/**
 * Guardião de coerência anatômica do Avatar Clínico.
 *
 * Objetivo: garantir que cada estrutura/ponto do avatar esteja na sua região
 * correta, sem divergência entre nome, segmento e sistema. Se alguém adicionar
 * uma região sem catálogo, uma estrutura duplicada ou marcar um órgão com um
 * sistema inexistente, este teste quebra no CI antes de chegar ao paciente.
 */

// Normaliza IDs de vistas posteriores (_p_/_p) para o ID base do catálogo,
// espelhando exatamente o fallback usado na UI (Body3DAvatar).
const baseId = (id: string) => id.replace(/_p_/, '_').replace(/_p$/, '');

const SISTEMAS_VALIDOS = new Set([
  'nervoso', 'circulatorio', 'respiratorio', 'digestorio', 'urinario',
  'endocrino', 'linfatico', 'reprodutor', 'musculoesqueletico',
  'sensorial', 'tegumentar',
]);

describe('Avatar Clínico — coerência anatômica', () => {
  it('toda região clicável resolve para um catálogo de estruturas', () => {
    const semCatalogo = REGIONS.filter(r => {
      const cat = STRUCTURES[r.id] ?? STRUCTURES[baseId(r.id)];
      return !cat || Object.keys(cat).length === 0;
    }).map(r => r.id);
    expect(semCatalogo, `Regiões sem catálogo: ${semCatalogo.join(', ')}`).toEqual([]);
  });

  it('nenhuma categoria de estrutura fica vazia', () => {
    const vazias: string[] = [];
    for (const [regiao, cats] of Object.entries(STRUCTURES)) {
      for (const [cat, lista] of Object.entries(cats)) {
        if (!Array.isArray(lista) || lista.length === 0) vazias.push(`${regiao}.${cat}`);
      }
    }
    expect(vazias, `Categorias vazias: ${vazias.join(', ')}`).toEqual([]);
  });

  it('não há estruturas duplicadas dentro de uma mesma categoria', () => {
    const dups: string[] = [];
    for (const [regiao, cats] of Object.entries(STRUCTURES)) {
      for (const [cat, lista] of Object.entries(cats)) {
        const vistos = new Set<string>();
        for (const nome of lista as string[]) {
          if (vistos.has(nome)) dups.push(`${regiao}.${cat}: "${nome}"`);
          vistos.add(nome);
        }
      }
    }
    expect(dups, `Duplicatas: ${dups.join(' | ')}`).toEqual([]);
  });

  it('todo catálogo de estruturas corresponde a uma região existente', () => {
    const idsValidos = new Set(REGIONS.flatMap(r => [r.id, baseId(r.id)]));
    const orfaos = Object.keys(STRUCTURES).filter(id => !idsValidos.has(id));
    expect(orfaos, `Catálogos sem região: ${orfaos.join(', ')}`).toEqual([]);
  });

  it('toda região visceral aponta para sistemas válidos', () => {
    const invalidos: string[] = [];
    for (const r of VISCERAL_REGIONS) {
      for (const s of r.sistemas) {
        if (!SISTEMAS_VALIDOS.has(s)) invalidos.push(`${r.id} → "${s}"`);
      }
    }
    expect(invalidos, `Sistemas inválidos: ${invalidos.join(', ')}`).toEqual([]);
  });

  it('todo órgão visceral tem ao menos um sistema e um path SVG', () => {
    const incompletos = VISCERAL_REGIONS
      .filter(r => !r.sistemas?.length || !r.d?.trim())
      .map(r => r.id);
    expect(incompletos, `Regiões viscerais incompletas: ${incompletos.join(', ')}`).toEqual([]);
  });

  it('IDs de região são únicos por vista (sem colisão front/back)', () => {
    const chave = (r: { id: string; view: string }) => `${r.view}:${r.id}`;
    const vistos = new Set<string>();
    const dups: string[] = [];
    for (const r of REGIONS) {
      if (vistos.has(chave(r))) dups.push(chave(r));
      vistos.add(chave(r));
    }
    expect(dups, `IDs duplicados: ${dups.join(', ')}`).toEqual([]);
  });

  it('toda estrutura visceral marca uma região corporal (não fica órfã)', () => {
    // O achado precisa colorir uma zona mesmo sem o órgão desenhado.
    // Exceção: estruturas tegumentares sistêmicas, sem localização segmentar.
    const orfaos = VISCERAL_REGIONS
      .filter(r => !ESTRUTURAS_SISTEMICAS.has(r.id))
      .filter(r => !zonaDeRegiao(r.id))
      .map(r => r.id);
    expect(orfaos, `Estruturas sem região: ${orfaos.join(', ')}`).toEqual([]);
  });

  it('toda região do mapeamento de sintomas resolve para uma zona corporal', () => {
    // Se um sintoma aponta para uma região que não pertence a nenhuma zona,
    // o achado não marca nada (ou marca lugar errado). Ex.: o bug do 'dorsal'.
    const orfaos = new Set<string>();
    for (const m of MAPEAMENTO_SINTOMAS) {
      for (const regiao of m.regioes) {
        if (ESTRUTURAS_SISTEMICAS.has(regiao)) continue;
        if (!zonaDeRegiao(regiao)) orfaos.add(regiao);
      }
    }
    expect([...orfaos], `Regiões de sintoma sem zona: ${[...orfaos].join(', ')}`).toEqual([]);
  });

  it('nenhuma estrutura visceral é reivindicada por duas regiões', () => {
    const dono = new Map<string, string[]>();
    for (const z of ZONAS_CORPORAIS) {
      for (const id of z.ids) {
        // Ignora os IDs próprios de zona MSK (compartilham nome entre front/back)
        if (!VISCERAL_REGIONS.some(v => v.id === id)) continue;
        dono.set(id, [...(dono.get(id) ?? []), z.id]);
      }
    }
    const divergentes = [...dono.entries()]
      .filter(([, zonas]) => new Set(zonas).size > 1)
      .map(([id, zonas]) => `${id} → {${[...new Set(zonas)].join(', ')}}`);
    expect(divergentes, `Estruturas em múltiplas regiões: ${divergentes.join(' | ')}`).toEqual([]);
  });
});
