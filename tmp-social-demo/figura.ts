import { desenharAngulo } from '@/lib/angular/desenharCanvas';
import { ESTILO_INSTAGRAM, type EstiloMarcacao } from '@/lib/angular/estilo';
import type { Landmark } from '@/lib/angular/pose';

export const W = 1200, H = 1600;

// Figura sintética de perfil (olhando para a direita) com o braço levantado.
export function figura(grausBraco: number, estilo: EstiloMarcacao = ESTILO_INSTAGRAM, marcar = true, desloca = 0): { canvas: HTMLCanvasElement; landmarks: Landmark[] } {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#cfd8e3'); g.addColorStop(0.72, '#b9c4d2'); g.addColorStop(0.72, '#7e8794'); g.addColorStop(1, '#656d79');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // parede com textura leve
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.02 + (i % 3) * 0.01})`; x.fillRect(i * 30, 0, 14, H * 0.72); }
  x.save(); x.translate(desloca, 0);
  const pele = '#d9a67f', peleSombra = '#c28d67', roupa = '#1d2535', short = '#2c3447';
  // pernas
  x.fillStyle = short;
  x.beginPath(); x.moveTo(585, 880); x.lineTo(700, 880); x.lineTo(690, 1250); x.lineTo(660, 1480); x.lineTo(590, 1480); x.lineTo(600, 1250); x.closePath(); x.fill();
  x.fillStyle = pele; x.fillRect(594, 1240, 85, 220);
  x.fillStyle = '#e8e8ea'; x.beginPath(); x.ellipse(650, 1490, 90, 28, 0, 0, Math.PI * 2); x.fill();
  // tronco
  x.fillStyle = roupa;
  x.beginPath(); x.moveTo(575, 440); x.quadraticCurveTo(540, 650, 575, 890); x.lineTo(705, 890); x.quadraticCurveTo(730, 650, 690, 440); x.closePath(); x.fill();
  // pescoço
  x.fillStyle = peleSombra; x.fillRect(612, 340, 58, 120);
  // cabeça
  x.fillStyle = pele; x.beginPath(); x.ellipse(640, 260, 86, 106, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(715, 255); x.lineTo(748, 282); x.lineTo(716, 295); x.closePath(); x.fill();
  x.fillStyle = '#2a1d16'; x.beginPath(); x.ellipse(622, 215, 92, 70, -0.1, Math.PI, Math.PI * 2.1); x.fill();
  x.fillStyle = '#1d1410'; x.beginPath(); x.arc(700, 243, 7, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#8f5b45'; x.fillRect(693, 320, 24, 5);
  x.fillStyle = peleSombra; x.beginPath(); x.ellipse(625, 278, 14, 24, 0, 0, Math.PI * 2); x.fill();
  // braço
  const S = { x: 635, y: 500 };
  const a = (grausBraco * Math.PI) / 180;
  const E = { x: S.x + 260 * Math.sin(a), y: S.y - 260 * Math.cos(a) * -1 };
  // direção: 0° = para baixo; cresce para a frente (direita) e para cima
  E.x = S.x + 260 * Math.sin(a); E.y = S.y + 260 * Math.cos(a);
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.strokeStyle = pele; x.lineWidth = 58; x.beginPath(); x.moveTo(S.x, S.y); x.lineTo(E.x, E.y); x.stroke();
  const M = { x: E.x + 60, y: E.y + 215 };
  x.lineWidth = 48; x.beginPath(); x.moveTo(E.x, E.y); x.lineTo(M.x, M.y); x.stroke();
  x.fillStyle = roupa; x.beginPath(); x.arc(S.x, S.y, 52, 0, Math.PI * 2); x.fill();
  x.restore();
  if (marcar) {
    const Sd = { x: S.x + desloca, y: S.y }, Ed = { x: E.x + desloca, y: E.y };
    desenharAngulo(x, Sd, Ed, { x: Sd.x, y: Sd.y + 330 }, estilo, grausBraco);
  }
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const n = (px: number, py: number, v = 0.95): Landmark => ({ x: (px + desloca) / W, y: py / H, visibility: v });
  lm[0] = n(748, 282); lm[1] = n(708, 243); lm[2] = n(700, 243); lm[3] = n(690, 243);
  lm[4] = n(700, 243, 0.1); lm[5] = n(700, 243, 0.1); lm[6] = n(700, 243, 0.1);
  lm[7] = n(625, 278); lm[8] = n(625, 278, 0.05); lm[9] = n(706, 322); lm[10] = n(706, 322, 0.1);
  return { canvas: c, landmarks: lm };
}
