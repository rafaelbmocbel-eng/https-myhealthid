import type { VistaSessao } from '@/lib/angular/tiposSessao';

/** O que pedir ao paciente em cada posição (vale para a tela e para a câmera do app). */
export const INSTRUCAO_DA_POSICAO: Record<VistaSessao, string> = {
  frente: 'Peça para ficar de frente para a câmera, com os braços soltos ao lado do corpo.',
  perfil_d: 'Peça para ficar de perfil, com o lado direito voltado para a câmera.',
  perfil_e: 'Peça para ficar de perfil, com o lado esquerdo voltado para a câmera.',
  costas: 'Peça para ficar de costas para a câmera, com os braços soltos ao lado do corpo.',
};

export const DICA_COMPARAR = 'Estimativa por foto: para comparar entre avaliações, repita na mesma distância, altura da câmera e roupa.';

export { ehMedidaParaConfirmar, ROTULO_CONFIRMAR } from '@/lib/angular/sessao';
