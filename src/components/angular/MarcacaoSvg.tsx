import { contextoDesenho, itemPonto, itemRotulo, itensDaReta, itensDoAngulo, type ItemDesenho, type PapelPonto } from '@/lib/angular/desenho';
import { FAMILIA_ROTULO, type EstiloMarcacao } from '@/lib/angular/estilo';
import type { Ponto as PontoXY } from '@/lib/angular/medidas';

// Só pinta os itens do núcleo de desenho (os mesmos que o canvas do PDF e do PNG usam), no sistema
// de coordenadas da foto. Não tem lógica de medida.

/** Itens já calculados; `opacidadePorGrupo` esmaece medidas inteiras (as que não são a ativa). */
export function ItensSvg({ itens, opacidadePorGrupo }: { itens: ItemDesenho[]; opacidadePorGrupo?: Record<string, number> }) {
  return (
    <g pointerEvents="none" strokeLinecap="round" strokeLinejoin="round">
      {itens.map((it, i) => {
        const opacidadeGrupo = it.grupo !== undefined ? opacidadePorGrupo?.[it.grupo] ?? 1 : 1;
        if (it.tipo === 'reta') {
          const dash = it.tracejado ? `${it.tracejado[0]} ${it.tracejado[1]}` : undefined;
          return (
            <g key={i} opacity={(it.opacidade ?? 1) * opacidadeGrupo}>
              {it.halo && <line x1={it.a.x} y1={it.a.y} x2={it.b.x} y2={it.b.y} stroke={it.halo.cor} strokeWidth={it.halo.largura} />}
              <line x1={it.a.x} y1={it.a.y} x2={it.b.x} y2={it.b.y} stroke={it.cor} strokeWidth={it.largura} strokeDasharray={dash} />
            </g>
          );
        }
        if (it.tipo === 'arco') {
          return (
            <g key={i} fill="none" opacity={opacidadeGrupo}>
              {it.halo && <path d={it.path} stroke={it.halo.cor} strokeWidth={it.halo.largura} />}
              <path d={it.path} stroke={it.cor} strokeWidth={it.largura} />
            </g>
          );
        }
        if (it.tipo === 'ponto') {
          return <circle key={i} cx={it.x} cy={it.y} r={it.raio} fill={it.cor} stroke={it.anel} strokeWidth={it.larguraAnel} opacity={opacidadeGrupo} />;
        }
        return (
          <g key={i} opacity={opacidadeGrupo}>
            {it.fundo && <rect x={it.x - it.largura / 2} y={it.y - it.altura / 2} width={it.largura} height={it.altura} rx={it.altura / 2} fill={it.fundo} stroke={it.borda} strokeWidth={it.larguraBorda} />}
            <text
              x={it.x} y={it.y + it.fonte * 0.04} textAnchor="middle" dominantBaseline="central" fontFamily={FAMILIA_ROTULO} fontWeight={700} fontSize={it.fonte} fill={it.cor}
              stroke={it.contorno} strokeWidth={it.contorno ? it.larguraContorno : undefined} paintOrder={it.contorno ? 'stroke' : undefined}
            >{it.texto}</text>
          </g>
        );
      })}
    </g>
  );
}

interface Base {
  estilo: EstiloMarcacao;
  /** Pixels da foto por unidade do estilo (`escalaDoEstilo(w, h)`). */
  escala: number;
  /** Tamanho da foto, para manter o rótulo dentro dela. */
  limites?: { w: number; h: number };
}

const contexto = (b: Base) => contextoDesenho(b.limites?.w ?? 100000, b.limites?.h ?? 100000, b.estilo, { k: b.escala });

/** Ângulo com vértice, dois braços, arco, pontas e rótulo. `graus` vira o texto; `texto` o substitui. */
export function MarcacaoAngulo({ vertice, a, b, graus, texto, tracejadoB, semPontas, ...base }: Base & {
  vertice: PontoXY; a: PontoXY; b: PontoXY; graus?: number; texto?: string; tracejadoB?: boolean; semPontas?: boolean;
}) {
  return <ItensSvg itens={itensDoAngulo(vertice, a, b, contexto(base), { graus, texto, tracejadoB, semPontas })} />;
}

export function MarcacaoReta({ a, b, cor, tracejada, semPontas, ...base }: Base & { a: PontoXY; b: PontoXY; cor?: string; tracejada?: boolean; semPontas?: boolean }) {
  return <ItensSvg itens={itensDaReta(a, b, contexto(base), { cor, tracejada, semPontas })} />;
}

/** Bolinha de uma ponta ou do vértice, na cor do estilo. */
export function Ponto({ x, y, papel = 'a', cor, ...base }: Base & { x: number; y: number; papel?: PapelPonto; cor?: string }) {
  return <ItensSvg itens={[itemPonto({ x, y }, papel, contexto(base), { cor })]} />;
}

/** Rótulo arredondado (ou texto com contorno, conforme o estilo) centrado em (x, y). */
export function Rotulo({ texto, x, y, ...base }: Base & { texto: string; x: number; y: number }) {
  return <ItensSvg itens={[itemRotulo(texto, x, y, contexto(base))]} />;
}
