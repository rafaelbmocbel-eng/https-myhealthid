import { figura, W, H } from './figura';
import { ESTILO_INSTAGRAM } from '@/lib/angular/estilo';
import { caixaDoRostoPorLandmarks, caixaRostoPadrao } from '@/lib/social/rosto';
import { carregarMarcaDoApp, gerarArteSocial, type OpcoesArte, type RecursosArte } from '@/lib/social';

const pre = figura(118);
const pos = figura(144, ESTILO_INSTAGRAM, true, 20);

function avatarSintetico(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 160; c.height = 160;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 160, 160); g.addColorStop(0, '#6ea8fe'); g.addColorStop(1, '#2c5aa0');
  x.fillStyle = g; x.fillRect(0, 0, 160, 160);
  x.fillStyle = '#f2c9a5'; x.beginPath(); x.arc(80, 70, 34, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.ellipse(80, 150, 58, 44, 0, 0, Math.PI * 2); x.fill();
  return c;
}

(window as unknown as Record<string, unknown>).gerar = async (cfg: Partial<OpcoesArte> & { dois?: boolean; selo?: boolean; avatar?: boolean; semRosto?: boolean }) => {
  const dois = cfg.dois !== false;
  const arte = {
    paineis: [
      { rotulo: 'Pré-Sessão', data: '11/10/2026', imagem: pre.canvas, largura: W, altura: H },
      ...(dois ? [{ rotulo: 'Pós-Sessão', data: '25/10/2026', imagem: pos.canvas, largura: W, altura: H }] : []),
    ],
    medidas: [],
  };
  const recursos: RecursosArte = {};
  if (cfg.selo !== false) recursos.selo = await carregarMarcaDoApp();
  if (cfg.avatar !== false) recursos.avatar = avatarSintetico();
  const rostos = cfg.semRosto ? [caixaRostoPadrao(W, H), caixaRostoPadrao(W, H)] : [caixaDoRostoPorLandmarks(pre.landmarks, W, H), caixaDoRostoPorLandmarks(pos.landmarks, W, H)];
  const { canvas, layout } = await gerarArteSocial(arte, {
    formato: 'story', layout: 'empilhada', tituloModo: 'vertical', titulo: 'Pós operatório de SLAP', legenda: '3ª Semana de PO',
    perfis: ['rafaelmocbel', 'myhealthid.app', 'physio.mocbel'], margensStories: true, modoRosto: 'desfoque', rostos, ...cfg,
  } as OpcoesArte, recursos, 1);
  return { url: canvas.toDataURL('image/png'), layout };
};
(window as unknown as Record<string, unknown>).pronto = true;
