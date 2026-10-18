import { describe, it } from 'vitest';
import { analisarMovimento } from '../lib/angular/movimento/analisarMovimento';
import type { AnaliseMovimento } from '../lib/angular/movimento/tipos';
import { eventosVerdadeMarcha, trilhaAgachamentoFrontal, trilhaAgachamentoLateral, trilhaMarcha } from './movimentoMotorSintetico';

const N = 100;
const pct = (k: number) => `${Math.round((100 * k) / N)}%`;
function taxa(fn: (semente: number) => boolean): string {
  let k = 0;
  for (let s = 1; s <= N; s++) if (fn(s)) k++;
  return pct(k);
}
const tem = (a: AnaliseMovimento, chave: string, gat: string, lado?: string) => a.achados.some((x) => x.chave === chave && x.gatilho === gat && (lado === undefined || x.lado === lado));

describe('taxas', () => {
  it('imprime', () => {
    const linhas: string[] = [];
    for (const sig of [1, 2]) {
      for (const d of [0, 3, 5, 8, 12]) {
        linhas.push(`LATERAL sigma ${sig}px dif joelho D-E ${d}°: detecção(lado D) ${taxa((s) => tem(analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: sig, semente: s, flexao: (l) => (l === 'D' ? 100 + d : 100) })), 'assimetria_flexao_joelho', 'assimetria_entre_lados', 'D'))}`);
      }
      linhas.push(`LATERAL sigma ${sig} simétrico: qualquer assimetria ${taxa((s) => analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: sig, semente: s })).achados.some((x) => x.gatilho === 'assimetria_entre_lados'))}`);
      for (const m of [0.0, 0.02, 0.04, 0.06]) {
        linhas.push(`FRONTAL sigma ${sig} medial D ${0.02 + m} vs E 0.02: valgo detectado lado D ${taxa((s) => tem(analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ ruidoPx: sig, semente: s, medial: (l) => (l === 'D' ? 0.02 + m : 0.02) })), 'valgo_dinamico', 'assimetria_entre_lados', 'D'))}`);
      }
      for (const sh of [0, 0.02, 0.04, 0.06]) {
        linhas.push(`FRONTAL sigma ${sig} pelve ${sh} m (${Math.round((sh / 0.3) * 100)}% da base) p/ D: detecção ${taxa((s) => tem(analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ ruidoPx: sig, semente: s, pelve: () => sh })), 'desvio_lateral_pelve', 'assimetria_entre_lados', 'D'))}`);
      }
      linhas.push(`FRONTAL sigma ${sig} simétrico: valgo/pelve assimetria ${taxa((s) => analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ ruidoPx: sig, semente: s })).achados.some((x) => x.gatilho === 'assimetria_entre_lados'))}`);
      for (const delta of [0, 5, 10, 20]) {
        linhas.push(`LATERAL sigma ${sig} flexão cai ${delta}° da 1ª à 5ª: tendência da flexão (sinal -) ${taxa((s) => analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: sig, semente: s, flexao: (_l, r) => 110 - (delta * r) / 4 })).achados.some((x) => x.chave === 'tendencia_na_serie' && x.medida === 'flexao_joelho_max' && (x.valor as number) < 0))} | tendência da profundidade ${taxa((s) => analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: sig, semente: s, flexao: (_l, r) => 110 - (delta * r) / 4 })).achados.some((x) => x.chave === 'tendencia_na_serie' && x.medida === 'profundidade_quadril' && (x.valor as number) < 0))}`);
      }
      for (const dl of [0, 0.04, 0.06, 0.1, 0.14]) {
        const apoio = { D: 0.6, E: 0.6 + dl / 1.1 };
        linhas.push(`MARCHA sigma ${sig} apoio E mais longo ${dl} s: auto ${taxa((s) => tem(analisarMovimento('marcha_lateral', trilhaMarcha({ ruidoPx: sig, semente: s, apoio })), 'assimetria_tempo_apoio', 'assimetria_entre_lados', 'E'))} | eventos conferidos ${taxa((s) => tem(analisarMovimento('marcha_lateral', trilhaMarcha({ ruidoPx: sig, semente: s, apoio }), { eventos: eventosVerdadeMarcha({ apoio }).eventos }), 'assimetria_tempo_apoio', 'assimetria_entre_lados', 'E'))}`);
      }
      linhas.push(`MARCHA sigma ${sig} simétrica: qualquer assimetria ${taxa((s) => analisarMovimento('marcha_lateral', trilhaMarcha({ ruidoPx: sig, semente: s })).achados.some((x) => x.gatilho === 'assimetria_entre_lados'))}`);
      for (const [nome, id, f] of [
        ['LATERAL', 'agachamento_lateral', (s: number) => trilhaAgachamentoLateral({ ruidoPx: sig, semente: s })],
        ['FRONTAL', 'agachamento_frontal', (s: number) => trilhaAgachamentoFrontal({ ruidoPx: sig, semente: s })],
        ['MARCHA', 'marcha_lateral', (s: number) => trilhaMarcha({ ruidoPx: sig, semente: s })],
      ] as const) {
        const por: Record<string, number> = {};
        let algum = 0;
        for (let s = 1; s <= N; s++) {
          const a = analisarMovimento(id, f(s));
          if (a.achados.length) algum++;
          for (const g of new Set(a.achados.map((x) => x.gatilho))) por[g] = (por[g] ?? 0) + 1;
        }
        linhas.push(`${nome} sigma ${sig} idêntico: vídeos com algum achado ${pct(algum)}; por gatilho ${JSON.stringify(por)}`);
      }
    }
    console.log('\n' + linhas.join('\n'));
  });
});
