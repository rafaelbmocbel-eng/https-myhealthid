import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { Toaster } from 'sonner';
import ExportarSocialDialog from '@/components/angular/ExportarSocialDialog';
import { figura, W, H } from './figura';

function App() {
  const params = new URLSearchParams(location.search);
  const dois = params.get('n') !== '1';
  const dados = useMemo(() => {
    const pre = figura(118);
    const pos = figura(144, undefined, true, 20);
    const arte = {
      titulo: 'Pós operatório de SLAP', legenda: '3ª Semana de PO',
      paineis: [
        { rotulo: 'Pré-Sessão', data: '11/10/2026', imagem: pre.canvas, largura: W, altura: H },
        ...(dois ? [{ rotulo: 'Pós-Sessão', data: '25/10/2026', imagem: pos.canvas, largura: W, altura: H }] : []),
      ],
      medidas: [{ nome: 'Elevação do ombro', valor: '118°' }],
    };
    return { arte, lm: params.get('semlm') ? [] : [pre.landmarks, pos.landmarks] };
  }, [dois]);
  const [aberto, setAberto] = useState(true);
  return (
    <>
      <button onClick={() => setAberto(true)}>abrir</button>
      <ExportarSocialDialog aberto={aberto} aoFechar={() => setAberto(false)} arte={dados.arte} landmarks={dados.lm} />
      <Toaster />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
(window as unknown as Record<string, unknown>).pronto = true;
