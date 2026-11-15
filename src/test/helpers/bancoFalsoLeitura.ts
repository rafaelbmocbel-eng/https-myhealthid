// Envolve o banco falso para testar telas e hooks que SÓ LEEM: registra cada chamada da consulta (select, eq, limit...),
// aceita .or() e .filter() sem avaliar (o banco falso não emula esses filtros do PostgREST: o teste confere que foram
// pedidos) e deixa uma tabela falhar na leitura, com erro devolvido ou com a promessa rejeitada (rede caiu).
import type { BancoFalso } from './bancoFalso';

export interface ChamadaDeLeitura {
  tabela: string;
  metodo: string;
  args: unknown[];
}

export interface BancoEnvolvido {
  from: (tabela: string) => unknown;
  rpc: BancoFalso['rpc'];
  chamadas: ChamadaDeLeitura[];
  // Faz toda leitura da tabela falhar.
  falharLeitura: (tabela: string, como?: 'erro' | 'rejeitar') => void;
}

const SEM_AVALIAR = new Set(['or', 'filter']);

export function envolverBanco(banco: BancoFalso): BancoEnvolvido {
  const chamadas: ChamadaDeLeitura[] = [];
  const falhas = new Map<string, 'erro' | 'rejeitar'>();

  const consultaQueFalha = (como: 'erro' | 'rejeitar'): unknown => {
    const consulta: unknown = new Proxy({}, {
      get(_alvo, prop) {
        if (prop === 'then') {
          return (resolver: (v: unknown) => unknown, rejeitar?: (e: unknown) => unknown) => {
            if (como === 'rejeitar') return Promise.reject(new Error('rede caiu')).then(resolver, rejeitar);
            return Promise.resolve({ data: null, error: { message: 'leitura falhou' } }).then(resolver, rejeitar);
          };
        }
        return () => consulta;
      },
    });
    return consulta;
  };

  const envolver = (tabela: string, original: object): unknown => {
    const proxy: unknown = new Proxy(original, {
      get(alvo, prop) {
        const valor = Reflect.get(alvo, prop, alvo);
        if (typeof prop === 'string' && SEM_AVALIAR.has(prop)) {
          return (...args: unknown[]) => {
            chamadas.push({ tabela, metodo: prop, args });
            return proxy;
          };
        }
        if (typeof valor !== 'function') return valor;
        return (...args: unknown[]) => {
          if (typeof prop === 'string' && prop !== 'then') chamadas.push({ tabela, metodo: prop, args });
          const resposta = valor.apply(alvo, args);
          return resposta === alvo ? proxy : resposta;
        };
      },
    });
    return proxy;
  };

  return {
    from: (tabela) => {
      const como = falhas.get(tabela);
      if (como) return consultaQueFalha(como);
      return envolver(tabela, banco.from(tabela) as object);
    },
    rpc: (nome, args) => banco.rpc(nome, args),
    chamadas,
    falharLeitura: (tabela, como = 'erro') => { falhas.set(tabela, como); },
  };
}
