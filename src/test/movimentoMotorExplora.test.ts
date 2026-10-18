import { describe, it } from 'vitest';
import { analisarMovimento } from '../lib/angular/movimento/analisarMovimento';
import { trilhaAgachamentoLateral, verdadeAgachamento } from './movimentoMotorSintetico';

describe('explora', () => {
  it('lateral', () => {
    const cfg = { ruidoPx: 1.5, semente: 3 };
    const trilha = trilhaAgachamentoLateral(cfg);
    const a = analisarMovimento('agachamento_lateral', trilha);
    const v = verdadeAgachamento(cfg);
    console.log('verdade fundo', v.fundo, 'inicio', v.inicio);
    console.log(a.repeticoes.map((r) => [r.numero, r.inicioT.toFixed(2), r.fundoT.toFixed(2), r.fimT.toFixed(2), r.sinalizadores.join(',')]));
    console.log(JSON.stringify(a.incerteza));
    for (const m of a.medidas) console.log(m.def.id, JSON.stringify(m.valores), JSON.stringify(m.incerteza), m.avisos);
    console.log(a.avisos);
    console.log(a.achados.map((x) => `${x.gatilho} ${x.chave} ${x.medida} ${x.lado} ${x.valor}`));
  });
});
