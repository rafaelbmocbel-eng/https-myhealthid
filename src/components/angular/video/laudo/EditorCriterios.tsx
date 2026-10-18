import { useId, useMemo, useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { criterioAplicavel, criterioValidoNoProtocolo } from '@/lib/angular/movimento/criterios';
import { maisOuMenos, valorComUnidade } from '@/lib/angular/movimento/frases';
import { achadoDoCatalogo } from '@/lib/angular/movimento/protocolos';
import type { Achado, AnaliseMovimento, CriterioProfissional, Protocolo } from '@/lib/angular/movimento/tipos';
import { ROTULO_LADO, ROTULO_SITUACAO } from '@/lib/angular/movimento/vocabulario';
import {
  aceitaLado, criterioVazio, GRANDEZA_TEXTO, ladoDoSeletor, lerValorDigitado, OPERADORES, opcoesDoProtocolo, rotuloAutomatico, valorDaOpcao, valorParaCampo,
  type OpcaoMetrica,
} from './criteriosUi';

type AtualizarCriterios = (f: (anteriores: CriterioProfissional[]) => CriterioProfissional[]) => void;

interface Props {
  protocolo: Protocolo;
  criterios: CriterioProfissional[];
  aoAtualizar: AtualizarCriterios;
  analise: AnaliseMovimento;
  /** Nome do profissional, sugerido em "Definido por" (ele pode trocar). */
  profissional?: string;
}

const campo = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium">{rotulo}</label>
      {children}
    </div>
  );
}

/** Resultado do critério na análise atual: é o mesmo cálculo do laudo, então a pré-visualização não diverge do PDF. */
function linhaDoResultado(a: Achado, cat: ReturnType<typeof achadoDoCatalogo>): string {
  const valor = `${valorComUnidade(a.valor, a.unidade)} (incerteza ${maisOuMenos(a.incerteza, a.unidade)})`;
  const situacao = ROTULO_SITUACAO[a.situacao];
  if (cat.grandeza === 'diferenca_entre_lados') return `Diferença entre os lados: ${valor}: ${situacao}.`;
  if (a.lado) return `Lado ${ROTULO_LADO[a.lado]}: ${valor}: ${situacao}.`;
  return `Valor: ${valor}: ${situacao}.`;
}

interface LinhaProps {
  c: CriterioProfissional;
  indice: number;
  protocolo: Protocolo;
  opcoes: OpcaoMetrica[];
  analise: AnaliseMovimento;
  aoAtualizar: AtualizarCriterios;
}

function LinhaCriterio({ c, indice, protocolo, opcoes, analise, aoAtualizar }: LinhaProps) {
  const base = useId();
  const [digitado, setDigitado] = useState(() => valorParaCampo(c.valor));
  const opcao = opcoes.find((o) => o.valor === valorDaOpcao(c.chave, c.metrica)) ?? null;
  const valido = criterioValidoNoProtocolo(c, protocolo) && !!opcao;
  const numero = indice + 1;

  const atualizar = (parcial: Partial<CriterioProfissional>, novaOpcao: OpcaoMetrica | null = opcao) => {
    aoAtualizar((lista) => lista.map((x) => {
      if (x.id !== c.id) return x;
      const proximo: CriterioProfissional = { ...x, ...parcial };
      // O rótulo acompanha a definição enquanto o profissional não o escreveu à mão.
      const opcaoAntes = opcoes.find((o) => o.valor === valorDaOpcao(x.chave, x.metrica));
      const sugeridoAntes = opcaoAntes && Number.isFinite(x.valor) ? rotuloAutomatico(x, opcaoAntes) : '';
      if (novaOpcao && (x.rotulo === '' || x.rotulo === sugeridoAntes)) proximo.rotulo = Number.isFinite(proximo.valor) ? rotuloAutomatico(proximo, novaOpcao) : '';
      // Sem valor ou sem responsável o critério não se aplica: desliga em vez de ficar ligado sem efeito.
      if (!Number.isFinite(proximo.valor) || proximo.definidoPor.trim() === '') proximo.ativo = false;
      return proximo;
    }));
  };

  const trocarMedida = (valor: string) => {
    const nova = opcoes.find((o) => o.valor === valor);
    if (!nova) return;
    atualizar({ chave: nova.chave, metrica: nova.metrica, unidade: nova.unidade, lado: aceitaLado(nova) ? c.lado : undefined }, nova);
  };

  const digitar = (texto: string) => {
    setDigitado(texto);
    const n = lerValorDigitado(texto);
    atualizar({ valor: n === null ? Number.NaN : n });
  };

  const completo = Number.isFinite(c.valor) && c.definidoPor.trim() !== '' && c.rotulo.trim() !== '';
  const podeLigar = completo && valido;
  const resultados = analise.achados.filter((a) => a.gatilho === 'criterio_profissional' && a.veredito?.criterio.id === c.id);
  const cat = achadoDoCatalogo(c.chave);

  let estado: string;
  if (!valido) estado = 'Guardado, mas não aplicado neste protocolo: a medida pertence a outro protocolo ou a outra vista.';
  else if (!c.ativo) estado = 'Desligado: não gera veredito.';
  else if (!criterioAplicavel(c)) estado = 'Ligado, mas não aplicado: falta o valor ou o nome de quem definiu o critério.';
  else if (!resultados.length) estado = 'Ligado. Sem valor medido para comparar neste vídeo.';
  else estado = 'Ligado. Resultado neste vídeo:';

  return (
    <li className="space-y-3 rounded-2xl border border-border/60 bg-card p-3" data-testid="criterio">
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 text-sm font-semibold leading-snug">Critério {numero}{c.rotulo ? `: ${c.rotulo}` : ''}</h4>
        <button type="button" onClick={() => aoAtualizar((l) => l.filter((x) => x.id !== c.id))} aria-label={`Remover o critério ${numero}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring" data-testid="remover-criterio">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {valido && opcao ? (
        <>
          <Campo id={`${base}-medida`} rotulo="Medida avaliada">
            <select id={`${base}-medida`} className={campo} value={opcao.valor} onChange={(e) => trocarMedida(e.target.value)} aria-describedby={`${base}-compara`}>
              {[...new Set(opcoes.map((o) => o.grupo))].map((grupo) => (
                <optgroup key={grupo} label={grupo}>
                  {opcoes.filter((o) => o.grupo === grupo).map((o) => <option key={o.valor} value={o.valor}>{o.nome} ({o.unidade})</option>)}
                </optgroup>
              ))}
            </select>
          </Campo>
          <p id={`${base}-compara`} className="-mt-1 text-[11px] leading-snug text-muted-foreground">Compara {GRANDEZA_TEXTO[opcao.grandeza]}.</p>
          {cat.criterioDebatido && cat.notaCriterio && <p className="rounded-xl bg-muted/50 p-2 text-[11px] leading-snug" data-testid="nota-criterio-debatido-editor">{cat.notaCriterio}</p>}

          {aceitaLado(opcao) && (
            <Campo id={`${base}-lado`} rotulo="Lado">
              <select id={`${base}-lado`} className={campo} value={c.lado ?? ''} onChange={(e) => atualizar({ lado: ladoDoSeletor(e.target.value) })}>
                <option value="">Cada lado separadamente</option>
                <option value="D">Só o direito</option>
                <option value="E">Só o esquerdo</option>
              </select>
            </Campo>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Campo id={`${base}-operador`} rotulo="Condição de referência">
              <select id={`${base}-operador`} className={campo} value={c.operador} onChange={(e) => atualizar({ operador: e.target.value as CriterioProfissional['operador'] })}>
                {OPERADORES.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </select>
            </Campo>
            <Campo id={`${base}-valor`} rotulo={`Valor do limite (${c.unidade})`}>
              <input id={`${base}-valor`} className={cn(campo, 'tabular-nums')} inputMode="decimal" autoComplete="off" value={digitado} onChange={(e) => digitar(e.target.value)}
                aria-invalid={digitado.trim() !== '' && lerValorDigitado(digitado) === null} />
            </Campo>
          </div>

          <Campo id={`${base}-rotulo`} rotulo="Rótulo do critério">
            <input id={`${base}-rotulo`} className={campo} autoComplete="off" value={c.rotulo} onChange={(e) => atualizar({ rotulo: e.target.value })}
              onBlur={() => { if (c.rotulo.trim() === '' && Number.isFinite(c.valor)) atualizar({ rotulo: rotuloAutomatico(c, opcao) }); }} placeholder="Preenchido sozinho quando houver valor" />
          </Campo>

          <Campo id={`${base}-definido`} rotulo="Definido por (obrigatório para ligar)">
            <input id={`${base}-definido`} className={campo} autoComplete="off" value={c.definidoPor} onChange={(e) => atualizar({ definidoPor: e.target.value })} placeholder="Nome de quem definiu o critério" />
          </Campo>

          <button type="button" role="switch" aria-checked={c.ativo} disabled={!podeLigar && !c.ativo} onClick={() => atualizar({ ativo: !c.ativo })} data-testid="ligar-criterio"
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/60 px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            <span>Critério ligado</span>
            <span aria-hidden className={cn('flex h-6 w-11 shrink-0 items-center rounded-full border border-border px-0.5 transition-colors', c.ativo ? 'bg-primary' : 'bg-muted')}>
              <span className={cn('h-[18px] w-[18px] rounded-full bg-background shadow transition-transform', c.ativo ? 'translate-x-5' : 'translate-x-0')} />
            </span>
          </button>
          {!podeLigar && !c.ativo && <p className="-mt-1 text-[11px] leading-snug text-muted-foreground">Para ligar: informe o valor do limite e quem definiu o critério.</p>}
        </>
      ) : (
        <p className="text-xs leading-snug text-muted-foreground">Critério: {c.rotulo || `${c.chave} / ${c.metrica}`}.</p>
      )}

      <div className="space-y-1 rounded-xl bg-muted/40 p-2.5 text-xs leading-snug" data-testid="estado-criterio" aria-live="polite">
        <p>{estado}</p>
        {valido && c.ativo && criterioAplicavel(c) && resultados.map((a) => <p key={a.id} className="font-medium">{linhaDoResultado(a, cat)}</p>)}
      </div>
    </li>
  );
}

// Critérios do profissional. Nascem desligados e sem valor: o app não sugere limite. Só o critério ligado, com valor e responsável,
// dá veredito (dentro do critério, no limite, fora do critério), sempre considerando a incerteza do vídeo.
export default function EditorCriterios({ protocolo, criterios, aoAtualizar, analise, profissional }: Props) {
  const opcoes = useMemo(() => opcoesDoProtocolo(protocolo), [protocolo]);
  return (
    <section className="space-y-2" aria-labelledby="laudo-criterios-titulo" data-testid="editor-criterios">
      <h3 id="laudo-criterios-titulo" className="text-sm font-semibold">Critérios do profissional</h3>
      <p className="text-xs leading-snug text-muted-foreground">
        Opcional. Cada critério nasce desligado e sem valor: o app não sugere limites. Só um critério ligado, com valor e com o nome de quem o definiu, dá veredito a um achado (dentro do critério, no limite ou fora do critério), levando em conta a incerteza do vídeo. O veredito vale só para o critério que você definiu. Os critérios ficam salvos no arquivo da análise.
      </p>
      {criterios.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card p-3 text-xs leading-snug text-muted-foreground" data-testid="sem-criterios">Nenhum critério definido: os achados são observações medidas, sem veredito.</p>}
      {criterios.length > 0 && (
        <ul className="space-y-2">
          {criterios.map((c, i) => <LinhaCriterio key={c.id} c={c} indice={i} protocolo={protocolo} opcoes={opcoes} analise={analise} aoAtualizar={aoAtualizar} />)}
        </ul>
      )}
      <button type="button" disabled={opcoes.length === 0} onClick={() => aoAtualizar((l) => [...l, criterioVazio(opcoes[0], profissional ?? '')])} data-testid="adicionar-criterio"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card px-3 text-sm font-semibold outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <Plus className="h-4 w-4" aria-hidden /> Adicionar critério
      </button>
    </section>
  );
}
