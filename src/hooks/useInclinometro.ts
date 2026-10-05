import { useCallback, useEffect, useRef, useState } from 'react';
import { inclinacaoDoAparelho, suavizarLeitura } from '@/lib/angular/sensor';

export type EstadoSensor = 'inativo' | 'ativo' | 'negado' | 'indisponivel';

type MotionComPermissao = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

// Lê o acelerômetro do celular (como o Nível do app Medidas do iPhone). No iPhone o navegador
// exige um toque do usuário para liberar o sensor; por isso `ativar` deve ser chamado de um clique.
export function useInclinometro() {
  const [estado, setEstado] = useState<EstadoSensor>('inativo');
  const [graus, setGraus] = useState<number | null>(null);
  const suave = useRef<number | null>(null);
  const ouvinte = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const parar = useCallback(() => {
    if (ouvinte.current) window.removeEventListener('devicemotion', ouvinte.current);
    ouvinte.current = null;
    suave.current = null;
    setGraus(null);
    setEstado('inativo');
  }, []);

  const ativar = useCallback(async () => {
    if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') { setEstado('indisponivel'); return; }
    const M = DeviceMotionEvent as MotionComPermissao;
    if (typeof M.requestPermission === 'function') {
      try {
        if ((await M.requestPermission()) !== 'granted') { setEstado('negado'); return; }
      } catch {
        // Sem toque do usuário ou contexto sem HTTPS: o navegador recusa o pedido.
        setEstado('negado');
        return;
      }
    }
    const fn = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const ang = inclinacaoDoAparelho({ x: a.x, y: a.y, z: a.z });
      if (ang === null) { suave.current = null; setGraus(null); return; }
      // Perto de ±180° a média móvel pularia; o ângulo aqui fica sempre dentro de ±45°.
      suave.current = suavizarLeitura(suave.current, ang);
      setGraus(suave.current);
    };
    ouvinte.current = fn;
    window.addEventListener('devicemotion', fn);
    setEstado('ativo');
  }, []);

  useEffect(() => () => { if (ouvinte.current) window.removeEventListener('devicemotion', ouvinte.current); }, []);

  return { estado, graus, ativar, parar };
}
